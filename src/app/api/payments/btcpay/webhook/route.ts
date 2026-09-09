import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWebhookSignature } from "@/lib/btcpay"
import { getGateway } from "@/lib/payments"
import {
  recordManualRefund,
  syncPayoutWithProvider,
} from "@/lib/payments/btc-payouts"
import { syncPurchaseWithPayment } from "@/lib/purchase-fulfillment"

/**
 * Уведомления BTCPay Server.
 *
 * Адрес задаётся в магазине (Settings → Webhooks) одной строкой на все
 * события:
 *
 *   https://<домен>/api/payments/btcpay/webhook
 *
 * Тело запроса — не доказательство оплаты: подлинность проверяется
 * HMAC-подписью из заголовка `BTCPay-Sig`, а состояние счёта всё равно
 * перечитывается из API.
 *
 * Событий нас интересует два вида:
 *   - по счетам (`Invoice*`) — двигают сделку;
 *   - по выплатам (`Payout*`) — говорят, что администратор подписал или
 *     отклонил вывод.
 */

interface BTCPayWebhookBody {
  type?: string
  invoiceId?: string
  payoutId?: string
  payoutState?: string
  storeId?: string
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!process.env.BTCPAY_WEBHOOK_SECRET) {
    console.error("BTCPAY_WEBHOOK_SECRET не задан — уведомления отклоняются")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!verifyWebhookSignature(rawBody, request.headers.get("btcpay-sig"))) {
    console.warn("Rejected BTCPay webhook with invalid signature")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: BTCPayWebhookBody

  try {
    body = JSON.parse(rawBody) as BTCPayWebhookBody
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const type = body.type ?? ""

  try {
    if (type.startsWith("Payout") && body.payoutId) {
      await handlePayoutEvent(body.payoutId, body.payoutState)
      return NextResponse.json({ success: true })
    }

    if (body.invoiceId) {
      await handleInvoiceEvent(body.invoiceId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("BTCPay webhook error:", error)
    // BTCPay повторит доставку — платёж не потеряется.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

/**
 * Состояние сделки приводится к тому, что о счёте говорит API. Тип
 * события при этом не важен: «оплачен», «истёк» и «подтверждён» —
 * это одно и то же состояние, увиденное в разные моменты.
 */
async function handleInvoiceEvent(invoiceId: string) {
  const payment = await getGateway("BTCPAY").getPayment(invoiceId)

  if (!payment.purchaseId) {
    console.warn(`BTCPay: счёт ${invoiceId} без номера заказа`)
    return
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id: payment.purchaseId },
    select: {
      id: true,
      amount: true,
      status: true,
      buyerId: true,
      paymentProvider: true,
      providerPaymentId: true,
      cryptoAmountSats: true,
    },
  })

  if (!purchase) {
    console.error("Purchase not found:", payment.purchaseId)
    return
  }

  if (purchase.paymentProvider !== "BTCPAY") {
    console.warn(
      `Purchase ${purchase.id} was paid through another provider`
    )
    return
  }

  // Покупка уже связана с другим счётом: вторая оплата того же заказа
  // ничего менять не должна.
  if (purchase.providerPaymentId && purchase.providerPaymentId !== payment.id) {
    console.warn(`Purchase ${purchase.id} is bound to another invoice`)
    return
  }

  const outcome = await syncPurchaseWithPayment(purchase.id, payment)

  console.log(
    `BTCPay webhook ${payment.status} for ${purchase.id}:`,
    outcome.result
  )

  // Деньги пришли, а сделки нет: счёт закрылся недоплаченным, оплата
  // подтвердилась после истечения срока или заказ к тому моменту уже
  // был закрыт. Полученное нужно вернуть — вручную, как и любой возврат
  // биткоина.
  const sats = payment.amountSats ?? 0

  if (sats > 0) {
    const fresh = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      select: { status: true },
    })

    const dealIsOff =
      payment.status === "canceled" ||
      fresh?.status === "FAILED" ||
      fresh?.status === "REFUNDED"

    if (dealIsOff) {
      await recordUnexpectedPayment(purchase.id, purchase.buyerId, sats)
    }
  }
}

/**
 * Заявка на возврат по несостоявшейся сделке. Создаётся один раз:
 * уведомление о том же счёте приходит не единожды.
 */
async function recordUnexpectedPayment(
  purchaseId: string,
  buyerId: string,
  sats: number
) {
  const existing = await prisma.payout.findFirst({
    where: { purchaseId, kind: "BUYER_REFUND" },
    select: { id: true },
  })

  if (existing) return

  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { cryptoAmountSats: sats, cryptoRefundedSats: sats },
    })

    await recordManualRefund(tx, {
      purchaseId,
      buyerId,
      sats,
      note: "Оплата пришла после закрытия счёта — сделка не состоялась",
    })
  })

  console.warn(
    `BTCPay: по покупке ${purchaseId} получено ${sats} сатоши вне сделки — оформлен возврат`
  )
}

/** Администратор подписал выплату либо отклонил её. */
async function handlePayoutEvent(payoutId: string, state?: string) {
  const payout = await prisma.payout.findFirst({
    where: { providerPayoutId: payoutId },
    select: { id: true },
  })

  if (!payout) {
    console.warn(`BTCPay: выплата ${payoutId} не найдена среди заявок`)
    return
  }

  const outcome = await syncPayoutWithProvider(payout.id, state)
  console.log(`BTCPay payout ${payoutId}:`, outcome?.status)
}
