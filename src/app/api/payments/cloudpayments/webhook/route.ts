import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  isPayoutTerminalConfigured,
  isTrustedCloudPaymentsIp,
  parseNotification,
  verifyNotificationSignature,
} from "@/lib/cloudpayments"
import { getGateway } from "@/lib/payments"
import { syncPurchaseWithPayment } from "@/lib/purchase-fulfillment"
import { getClientIp } from "@/lib/rate-limit"

/**
 * Уведомления CloudPayments (check, pay, fail, confirm, cancel, refund).
 *
 * В личном кабинете для каждого типа задаётся свой адрес, а в теле
 * запроса тип не передаётся — поэтому он приходит в query-параметре:
 *
 *   https://<домен>/api/payments/cloudpayments/webhook?type=pay
 *
 * Подпись считается только по телу, так что параметр её не ломает.
 * Если параметр не задан, тип определяется по составу полей.
 *
 * Тело запроса — не доказательство оплаты: подлинность проверяется
 * адресом отправителя и HMAC-подписью, а состояние платежа всё равно
 * перечитывается из API CloudPayments.
 *
 * Ответ всегда `{"code": 0}` — это «уведомление принято». Другие коды
 * осмысленны только для check: ими платёж отклоняется.
 */

/** Коды ответа на check-уведомление. */
const CHECK_OK = 0
const CHECK_INVALID_INVOICE = 10
const CHECK_INVALID_AMOUNT = 12
const CHECK_NOT_ACCEPTED = 13

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  if (!isTrustedCloudPaymentsIp(ip)) {
    console.warn("Rejected CloudPayments webhook from untrusted IP:", ip)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rawBody = await request.text()

  const signature = {
    contentHmac: request.headers.get("content-hmac"),
    xContentHmac: request.headers.get("x-content-hmac"),
  }

  // Выплаты продавцам идут через второй терминал, и уведомления по ним
  // подписаны его ключом.
  const signed =
    verifyNotificationSignature(rawBody, signature, "payment") ||
    (isPayoutTerminalConfigured() &&
      verifyNotificationSignature(rawBody, signature, "payout"))

  if (!signed) {
    console.warn("Rejected CloudPayments webhook with invalid signature")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data = parseNotification(rawBody, request.headers.get("content-type"))
  const type = request.nextUrl.searchParams.get("type")?.toLowerCase() ?? ""

  try {
    if (type === "check") {
      return NextResponse.json({ code: await handleCheck(data) })
    }

    if (type === "refund" || data.PaymentTransactionId) {
      await handleRefund(data)
      return NextResponse.json({ code: CHECK_OK })
    }

    await handlePaymentEvent(data)
    return NextResponse.json({ code: CHECK_OK })
  } catch (error) {
    console.error("CloudPayments webhook error:", error)
    // Ошибка обработки — не отвечаем нулём: CloudPayments повторит
    // доставку, и платёж не потеряется.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

/**
 * Check выполняется до списания и решает, принимать ли платёж. Виджет
 * запускается на стороне покупателя, поэтому именно здесь проверяется,
 * что сумма и заказ не подменены.
 */
async function handleCheck(data: Record<string, string>): Promise<number> {
  const purchaseId = data.InvoiceId

  if (!purchaseId) return CHECK_INVALID_INVOICE

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, amount: true, status: true, paymentProvider: true },
  })

  if (!purchase || purchase.paymentProvider !== "CLOUDPAYMENTS") {
    return CHECK_INVALID_INVOICE
  }

  // Оплачивать можно только заказ, который ещё ждёт оплаты.
  if (purchase.status !== "PENDING") return CHECK_NOT_ACCEPTED

  const amount = Number(data.Amount)

  if (!Number.isFinite(amount) || Math.round(amount) !== purchase.amount) {
    console.warn(
      `CloudPayments check: сумма ${data.Amount} не совпадает с покупкой ${purchaseId} (${purchase.amount})`
    )
    return CHECK_INVALID_AMOUNT
  }

  return CHECK_OK
}

/**
 * Pay / Confirm / Cancel / Fail. Тип уведомления не важен: состояние
 * сделки приводится к тому, что о транзакции говорит API.
 */
async function handlePaymentEvent(data: Record<string, string>) {
  const transactionId = data.TransactionId
  const purchaseId = data.InvoiceId

  if (!transactionId || !purchaseId) {
    console.error("CloudPayments webhook without TransactionId/InvoiceId")
    return
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      amount: true,
      status: true,
      paymentProvider: true,
      providerPaymentId: true,
    },
  })

  if (!purchase) {
    console.error("Purchase not found:", purchaseId)
    return
  }

  if (purchase.paymentProvider !== "CLOUDPAYMENTS") {
    console.warn(`Purchase ${purchaseId} was paid through another provider`)
    return
  }

  // Источник истины — ответ API, а не тело уведомления.
  const payment = await getGateway("CLOUDPAYMENTS").getPayment(transactionId)

  if (payment.purchaseId !== purchase.id) {
    console.warn(
      `Transaction ${transactionId} does not reference purchase ${purchaseId}`
    )
    return
  }

  // Покупка уже связана с другой транзакцией: вторая оплата того же
  // заказа не должна ничего менять.
  if (purchase.providerPaymentId && purchase.providerPaymentId !== payment.id) {
    console.warn(`Purchase ${purchaseId} is bound to another transaction`)
    return
  }

  // Заморожено/списано должно быть не больше выставленного счёта.
  // Меньше — законный случай: частичное списание при возврате по спору.
  if (payment.status !== "canceled" && payment.amount > purchase.amount) {
    console.warn(
      `Amount mismatch for ${purchaseId}: got ${payment.amount}, expected ${purchase.amount}`
    )
    return
  }

  const outcome = await syncPurchaseWithPayment(purchase.id, payment)
  console.log(
    `CloudPayments webhook ${payment.status} for ${purchaseId}:`,
    outcome.result
  )
}

/**
 * Возврат мог быть сделан и вне площадки — из личного кабинета
 * CloudPayments. Суммарного возврата по платежу API не отдаёт, поэтому
 * сумма накапливается у нас, а номер операции защищает от повторного
 * учёта при повторной доставке уведомления.
 */
async function handleRefund(data: Record<string, string>) {
  // Уведомления о выплатах продавцам приходят сюда же — они к возвратам
  // покупателю отношения не имеют.
  if (data.OperationType === "CardPayout") return

  const refundId = data.TransactionId
  const paymentTransactionId = data.PaymentTransactionId
  const amount = Math.round(Number(data.Amount))

  if (!refundId || !Number.isFinite(amount) || amount <= 0) return

  const purchase = data.InvoiceId
    ? await prisma.purchase.findUnique({ where: { id: data.InvoiceId } })
    : await prisma.purchase.findFirst({
        where: {
          paymentProvider: "CLOUDPAYMENTS",
          providerPaymentId: paymentTransactionId,
        },
      })

  if (!purchase || purchase.paymentProvider !== "CLOUDPAYMENTS") return

  // Возврат уже учтён — например, мы сами его и провели.
  if (purchase.refundTransactionIds.includes(refundId)) return

  const captured = purchase.capturedAmount ?? purchase.amount
  const totalRefunded = Math.min(purchase.refundedAmount + amount, captured)

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      refundedAmount: totalRefunded,
      refundTransactionIds: { push: refundId },
      ...(totalRefunded >= captured ? { status: "REFUNDED" as const } : {}),
    },
  })
}
