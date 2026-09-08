import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPayment, isTrustedYooKassaIp } from "@/lib/yookassa"
import { syncPurchaseWithPayment } from "@/lib/purchase-fulfillment"
import { getClientIp } from "@/lib/rate-limit"

interface YooKassaWebhookEvent {
  type?: string
  event?: string
  object?: {
    id?: string
    status?: string
    payment_id?: string
    amount?: {
      value: string
      currency: string
    }
    metadata?: {
      purchaseId?: string
      productId?: string
      buyerId?: string
    }
  }
}

/**
 * Уведомления ЮKassa.
 *
 * Тело запроса — это НЕ доказательство оплаты: его может прислать кто
 * угодно. Поэтому проверяем два независимых условия:
 *   1) запрос пришёл с адреса ЮKassa;
 *   2) состояние платежа получено обращением к API ЮKassa, и его сумма
 *      и назначение совпадают с покупкой в нашей базе.
 * Только после обеих проверок меняем состояние сделки.
 *
 * В настройках магазина должны быть включены события:
 * payment.waiting_for_capture (деньги заморожены — выдаём товар),
 * payment.succeeded (списание подтверждено), payment.canceled,
 * refund.succeeded.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  if (!isTrustedYooKassaIp(ip)) {
    console.warn("Rejected webhook from untrusted IP:", ip)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let event: YooKassaWebhookEvent

  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    if (event.event === "refund.succeeded") {
      await handleRefund(event)
      return NextResponse.json({ success: true })
    }

    const paymentId = event.object?.id
    const purchaseId = event.object?.metadata?.purchaseId

    if (!paymentId || !purchaseId) {
      console.error("Webhook without paymentId/purchaseId")
      // Отвечаем 200: повторять доставку такого уведомления бессмысленно
      return NextResponse.json({ success: true })
    }

    if (
      event.event === "payment.waiting_for_capture" ||
      event.event === "payment.succeeded" ||
      event.event === "payment.canceled"
    ) {
      await handlePaymentEvent(paymentId, purchaseId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    // 500 заставит ЮKassa повторить доставку — это правильнее, чем
    // молча потерять платёж, ответив 200.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

async function handlePaymentEvent(paymentId: string, purchaseId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, amount: true, status: true, yookassaPaymentId: true },
  })

  if (!purchase) {
    console.error("Purchase not found:", purchaseId)
    return
  }

  // Источник истины — ответ API ЮKassa, а не тело уведомления
  const payment = await getPayment(paymentId)

  if (payment.metadata?.purchaseId !== purchaseId) {
    console.warn(`Payment ${paymentId} does not reference purchase ${purchaseId}`)
    return
  }

  // Платёж должен относиться именно к этой покупке
  if (purchase.yookassaPaymentId && purchase.yookassaPaymentId !== paymentId) {
    console.warn(`Purchase ${purchaseId} is bound to another payment`)
    return
  }

  // Заморожено/списано должно быть не больше выставленного счёта.
  // Меньше — законный случай: частичное списание при возврате по спору.
  if (payment.status !== "canceled" && Number(payment.amount.value) > purchase.amount) {
    console.warn(
      `Amount mismatch for ${purchaseId}: got ${payment.amount.value}, expected ${purchase.amount}`
    )
    return
  }

  const outcome = await syncPurchaseWithPayment(purchaseId, payment)
  console.log(
    `Webhook ${payment.status} for ${purchaseId}:`,
    outcome.result
  )
}

/**
 * Возврат мог быть инициирован и вне площадки (из личного кабинета
 * ЮKassa), поэтому сумму возврата фиксируем по уведомлению.
 */
async function handleRefund(event: YooKassaWebhookEvent) {
  const paymentId = event.object?.payment_id
  const refundedValue = event.object?.amount?.value

  if (!paymentId || !refundedValue) return

  const payment = await getPayment(paymentId)
  const purchaseId = payment.metadata?.purchaseId

  if (!purchaseId) return

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, amount: true, capturedAmount: true },
  })

  if (!purchase) return

  // Сумму берём из платежа: там она уже агрегирована по всем возвратам.
  const totalRefunded = Math.round(
    Number(payment.refunded_amount?.value ?? refundedValue)
  )

  if (!Number.isFinite(totalRefunded) || totalRefunded <= 0) return

  const captured = purchase.capturedAmount ?? purchase.amount

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      refundedAmount: totalRefunded,
      ...(totalRefunded >= captured ? { status: "REFUNDED" as const } : {}),
    },
  })
}
