import {
  buildTransfers,
  cancelPayment,
  capturePayment,
  createPayment,
  createRefund,
  getPayment,
  type YooKassaPayment,
} from "@/lib/yookassa"
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
import { isYooKassaConfigured } from "@/lib/payments/config"

/**
 * ЮKassa: холдирование через `capture: false` и сплитование через
 * массив `transfers` («ЮKassa для платформ»). Деньги распределяются
 * в момент подтверждения, отдельной выплаты не требуется.
 */

function toProviderPayment(payment: YooKassaPayment): ProviderPayment {
  return {
    provider: "YOOKASSA",
    id: payment.id,
    status: payment.status as ProviderPaymentStatus,
    amount: Number(payment.amount.value),
    refundedAmount: Number(payment.refunded_amount?.value ?? 0),
    expiresAt: payment.expires_at ? new Date(payment.expires_at) : null,
    purchaseId: payment.metadata?.purchaseId ?? null,
  }
}

export const yookassaGateway: PaymentGateway = {
  id: "YOOKASSA",
  title: "ЮKassa",

  isConfigured() {
    return isYooKassaConfigured()
  },

  supportsSplit() {
    return true
  },

  splitHappensWithCapture: true,
  refundReclaimsSellerShare: true,

  splitAccountOf(seller: SellerPayoutAccounts) {
    return seller.yookassaAccountId || null
  },

  async createHold({
    purchaseId,
    productId,
    buyerId,
    amount,
    commission,
    description,
    returnUrl,
    splitAccountId,
  }: CreateHoldParams): Promise<CreateHoldResult> {
    const payment = await createPayment({
      amount,
      description,
      returnUrl,
      capture: false,
      idempotenceKey: `payment-${purchaseId}`,
      transfers: splitAccountId
        ? buildTransfers({ accountId: splitAccountId, amount, commission })
        : undefined,
      metadata: { purchaseId, productId, buyerId },
    })

    const confirmationUrl = payment.confirmation?.confirmation_url

    if (!confirmationUrl) {
      throw new Error(`ЮKassa не вернула ссылку на оплату для ${purchaseId}`)
    }

    return { paymentId: payment.id, confirmationUrl }
  },

  async getPayment(paymentId: string): Promise<ProviderPayment> {
    return toProviderPayment(await getPayment(paymentId))
  },

  async findPaymentByPurchase(): Promise<ProviderPayment | null> {
    // ЮKassa не ищет платежи по метаданным, а её платёж известен нам
    // с момента создания — искать нечего.
    return null
  },

  async capture({
    purchaseId,
    paymentId,
    amount,
    commission,
    splitAccountId,
  }: CaptureParams): Promise<CaptureResult> {
    const payment = await capturePayment(paymentId, {
      amount,
      transfers: splitAccountId
        ? buildTransfers({ accountId: splitAccountId, amount, commission })
        : undefined,
      idempotenceKey: `capture-${purchaseId}-${amount}`,
    })

    return {
      status: payment.status as ProviderPaymentStatus,
      // Сплит происходит внутри самого capture: если transfers были
      // переданы, деньги уже на счёте продавца.
      splitSettled: Boolean(splitAccountId) && payment.status === "succeeded",
    }
  },

  async cancel(paymentId: string, purchaseId: string): Promise<ProviderPayment> {
    return toProviderPayment(
      await cancelPayment(paymentId, `cancel-${purchaseId}`)
    )
  },

  async refund({
    purchaseId,
    paymentId,
    amount,
    commission,
    splitAccountId,
    alreadyRefunded,
  }: RefundParams): Promise<{ refundId: string | null }> {
    const refund = await createRefund({
      paymentId,
      amount,
      // Деньги забираются со счёта продавца, комиссия возвращается
      // площадкой пропорционально.
      sources: splitAccountId
        ? buildTransfers({ accountId: splitAccountId, amount, commission })
        : undefined,
      description: `Возврат по покупке ${purchaseId}`,
      // Уже возвращённая сумма входит в ключ: два одинаковых по величине
      // частичных возврата не должны схлопнуться в один.
      idempotenceKey: `refund-${purchaseId}-${alreadyRefunded}-${amount}`,
    })

    if (refund.status === "canceled") {
      throw new Error(`ЮKassa отклонила возврат по покупке ${purchaseId}`)
    }

    return { refundId: refund.id }
  },
}
