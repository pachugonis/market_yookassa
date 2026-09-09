import {
  CloudPaymentsError,
  confirmPayment,
  findTransactionByInvoice,
  getTransaction,
  payoutByToken,
  refundPayment,
  voidPayment,
  type CloudPaymentsTransaction,
} from "@/lib/cloudpayments"
import {
  isCloudPaymentsConfigured,
  isCloudPaymentsPayoutConfigured,
} from "@/lib/payments/config"
import type {
  CaptureParams,
  CaptureResult,
  CreateHoldParams,
  CreateHoldResult,
  PaymentGateway,
  ProviderPayment,
  ProviderPaymentStatus,
  RefundParams,
  SellerPayoutAccounts,
} from "@/lib/payments/types"

/**
 * CloudPayments: холдирование через двухстадийную схему (Dual) и
 * сплитование через «Безопасную сделку» по схеме 1:N.
 *
 * Отличие от ЮKassa в двух местах:
 *
 *   1. Оплата начинается в виджете на странице площадки, а не по ссылке
 *      от провайдера — только так можно передать параметры безопасной
 *      сделки. Номер транзакции появляется у нас из уведомления Pay
 *      либо поиском по номеру заказа.
 *   2. Сплит — не часть подтверждения, а отдельная операция: сначала
 *      `payments/confirm` списывает деньги в накопление, затем
 *      `payments/token/topup` переводит долю продавца на его карту.
 *      Комиссия площадки остаётся тем, что не выплачено.
 */

/**
 * Сколько живёт авторизация. CloudPayments даёт до 7 дней в зависимости
 * от типа карты и не сообщает точный срок в API, поэтому берём нижнюю
 * границу — подтвердить сделку нужно раньше.
 */
const HOLD_DAYS = readPositiveNumber(process.env.CLOUDPAYMENTS_HOLD_DAYS, 7)

function readPositiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function toStatus(transaction: CloudPaymentsTransaction): ProviderPaymentStatus {
  switch (transaction.Status) {
    case "Authorized":
      return "waiting_for_capture"
    case "Completed":
      return "succeeded"
    case "Cancelled":
    case "Declined":
      return "canceled"
    default:
      // AwaitingAuthentication и всё неизвестное: платёж ещё в пути.
      return "pending"
  }
}

function toProviderPayment(
  transaction: CloudPaymentsTransaction
): ProviderPayment {
  const authDate = transaction.AuthDateIso ?? transaction.CreatedDateIso
  const authenticated = authDate ? new Date(authDate) : null

  return {
    provider: "CLOUDPAYMENTS",
    id: String(transaction.TransactionId),
    status: toStatus(transaction),
    amount: Number(transaction.Amount),
    // API не отдаёт сумму возвратов по платежу — только признак того,
    // что возврат был. Частичные возвраты мы и так считаем у себя,
    // опираясь на уведомление Refund.
    refundedAmount: transaction.Refunded ? Number(transaction.Amount) : 0,
    expiresAt:
      authenticated && toStatus(transaction) === "waiting_for_capture"
        ? new Date(authenticated.getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000)
        : null,
    purchaseId: transaction.InvoiceId || null,
    accumulationId: transaction.EscrowAccumulationId ?? null,
  }
}

function transactionId(paymentId: string): number {
  const id = Number(paymentId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Некорректный номер транзакции CloudPayments: ${paymentId}`)
  }

  return id
}

export const cloudpaymentsGateway: PaymentGateway = {
  id: "CLOUDPAYMENTS",
  title: "CloudPayments",

  isConfigured() {
    return isCloudPaymentsConfigured()
  },

  supportsSplit() {
    // Без терминала выплат «Безопасная сделка» неполна: накопление
    // создать можно, а перевести долю продавцу — нет.
    return isCloudPaymentsPayoutConfigured()
  },

  splitHappensWithCapture: false,
  refundReclaimsSellerShare: false,

  splitAccountOf(seller: SellerPayoutAccounts) {
    if (!isCloudPaymentsPayoutConfigured()) return null
    return seller.cloudpaymentsPayoutToken || null
  },

  async createHold({ purchaseId }: CreateHoldParams): Promise<CreateHoldResult> {
    // Виджет запускается на нашей странице: параметры сделки она берёт
    // с сервера, а не из запроса покупателя.
    return {
      paymentId: null,
      confirmationUrl: `/payment/cloudpayments/${purchaseId}`,
    }
  },

  async getPayment(paymentId: string): Promise<ProviderPayment> {
    return toProviderPayment(await getTransaction(transactionId(paymentId)))
  },

  async findPaymentByPurchase(
    purchaseId: string
  ): Promise<ProviderPayment | null> {
    const transaction = await findTransactionByInvoice(purchaseId)
    return transaction ? toProviderPayment(transaction) : null
  },

  async capture({
    purchaseId,
    paymentId,
    amount,
    commission,
    splitAccountId,
    sellerId,
    accumulationId,
  }: CaptureParams): Promise<CaptureResult> {
    const id = transactionId(paymentId)

    await confirmPayment(id, amount, `confirm-${purchaseId}-${amount}`)

    const sellerEarnings = amount - commission

    if (!splitAccountId || !accumulationId || sellerEarnings <= 0) {
      // Сплита нет: деньги остались у площадки и уйдут продавцу
      // через внутренний баланс.
      if (splitAccountId && !accumulationId) {
        console.warn(
          `Покупка ${purchaseId}: у платежа CloudPayments нет накопления, выплата продавцу пойдёт через баланс`
        )
      }
      return { status: "succeeded", splitSettled: false }
    }

    try {
      const payout = await payoutByToken({
        token: splitAccountId,
        amount: sellerEarnings,
        accountId: sellerId,
        invoiceId: purchaseId,
        accumulationId,
        transactionIds: [id],
        // Остаток накопления — комиссия площадки, поэтому сделку
        // закрываем явно, не дожидаясь выплаты всей суммы.
        finalPayout: true,
        requestId: `payout-${purchaseId}-${sellerEarnings}`,
      })

      return {
        status: "succeeded",
        splitSettled: true,
        splitPayoutId: String(payout.TransactionId),
      }
    } catch (error) {
      // Деньги уже списаны с покупателя, поэтому откатывать нечего:
      // выручка продавца зачисляется на внутренний баланс, а выплата
      // проводится через обычную заявку.
      console.error(
        `Выплата продавцу по покупке ${purchaseId} не прошла:`,
        error instanceof CloudPaymentsError ? error.body : error
      )
      return { status: "succeeded", splitSettled: false }
    }
  },

  async cancel(paymentId: string, purchaseId: string): Promise<ProviderPayment> {
    const id = transactionId(paymentId)

    await voidPayment(id, `void-${purchaseId}`)

    return toProviderPayment(await getTransaction(id))
  },

  async refund({
    purchaseId,
    paymentId,
    amount,
    alreadyRefunded,
  }: RefundParams): Promise<{ refundId: string | null }> {
    // Возврат идёт с терминала оплат. Если доля продавца уже выплачена
    // на его карту, вернуть её обратно CloudPayments не даёт — недостача
    // гасится через внутренний баланс продавца.
    const refund = await refundPayment(
      transactionId(paymentId),
      amount,
      `refund-${purchaseId}-${alreadyRefunded}-${amount}`
    )

    return { refundId: refund ? String(refund.TransactionId) : null }
  },
}
