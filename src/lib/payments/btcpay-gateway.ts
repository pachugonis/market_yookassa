import {
  btcToSats,
  createInvoice,
  findInvoiceByOrderId,
  getInvoice,
  getInvoicePaymentMethods,
  markInvoiceInvalid,
  type BTCPayInvoice,
  type BTCPayInvoicePaymentMethod,
} from "@/lib/btcpay"
import { isBTCPayConfigured } from "@/lib/payments/config"
import type {
  CaptureParams,
  CaptureResult,
  CreateHoldParams,
  CreateHoldResult,
  PaymentGateway,
  ProviderPayment,
  ProviderPaymentStatus,
  RefundParams,
} from "@/lib/payments/types"

/**
 * BTCPay Server: оплата биткоином по рублёвой цене.
 *
 * От карточных сервисов отличается тем, что здесь нет ни холда, ни
 * сплитования:
 *
 *   1. Холда не существует. Полученный биткоин уже у площадки, отменить
 *      транзакцию нельзя. Роль «заморозки» играет сама сделка: товар
 *      выдан, но выручка продавцу ещё не начислена. Поэтому оплаченный
 *      счёт (`Settled`) отображается как `waiting_for_capture`, а
 *      подтверждение приёма — обычная бухгалтерская проводка без
 *      обращения к сети.
 *   2. Сплитования нет. Все деньги приходят в кошелёк площадки, доля
 *      продавца зачисляется на его внутренний баланс в сатоши и
 *      выводится отдельной заявкой (`src/lib/payments/btc-payouts.ts`).
 *
 * Курс фиксируется в момент выставления счёта: делится между продавцом
 * и площадкой не рублёвая цена, а фактически полученные сатоши, и
 * дальнейшие колебания курса на расчёт не влияют.
 */

/** Заведомо оплаченный счёт: деньги в кошельке площадки. */
function isPaidStatus(invoice: BTCPayInvoice): boolean {
  return invoice.status === "Settled" || invoice.status === "Processing"
}

function toStatus(invoice: BTCPayInvoice): ProviderPaymentStatus {
  switch (invoice.status) {
    case "Settled":
      // Оплачено и подтверждено сетью — сделка переходит в удержание.
      return "waiting_for_capture"
    case "Processing":
      // Платёж увидели, но подтверждений сети ещё нет.
      return "pending"
    case "Expired":
    case "Invalid":
      return "canceled"
    default:
      return "pending"
  }
}

/** Биткоиновый способ оплаты счёта: в разных версиях зовётся по-разному. */
function onchainMethod(
  methods: BTCPayInvoicePaymentMethod[]
): BTCPayInvoicePaymentMethod | null {
  if (!Array.isArray(methods) || methods.length === 0) return null

  return (
    methods.find((method) =>
      [method.paymentMethodId, method.paymentMethod, method.cryptoCode].some(
        (id) => id === "BTC-CHAIN" || id === "BTC"
      )
    ) ?? methods[0]
  )
}

/**
 * Сколько сатоши получено по счёту и по какому курсу. Считаем принятым
 * всё, что пришло: переплата остаётся в сделке и делится наравне
 * с остальной суммой.
 */
export function paidSats(methods: BTCPayInvoicePaymentMethod[]): {
  sats: number
  rateRub: number | null
} {
  const method = onchainMethod(methods)

  if (!method) return { sats: 0, rateRub: null }

  const sats = btcToSats(method.totalPaid ?? method.paid ?? "0")
  const rate = Number(method.rate)

  return {
    sats,
    rateRub: Number.isFinite(rate) && rate > 0 ? Math.round(rate) : null,
  }
}

async function toProviderPayment(
  invoice: BTCPayInvoice
): Promise<ProviderPayment> {
  // Открытый счёт спрашивать не о чем: пока он живой, решать нечего.
  // У закрытого важно знать, пришло ли по нему что-нибудь, — даже если
  // он истёк или помечен недействительным.
  const methods =
    invoice.status === "New" ? [] : await safePaymentMethods(invoice.id)

  const { sats, rateRub } = paidSats(methods)
  const orderId = invoice.metadata?.orderId

  return {
    provider: "BTCPAY",
    id: invoice.id,
    status: toStatus(invoice),
    amount: Number(invoice.amount),
    // Возвраты биткоина проводятся вручную и учитываются у нас, а не
    // в BTCPay: спрашивать его о возвращённой сумме бессмысленно.
    refundedAmount: 0,
    // Срока удержания нет: деньги уже получены и сами не вернутся.
    expiresAt: null,
    purchaseId: typeof orderId === "string" ? orderId : null,
    amountSats: sats,
    rateRub,
  }
}

async function safePaymentMethods(
  invoiceId: string
): Promise<BTCPayInvoicePaymentMethod[]> {
  try {
    return await getInvoicePaymentMethods(invoiceId)
  } catch (error) {
    console.error(`Не удалось прочитать оплату счёта ${invoiceId}:`, error)
    return []
  }
}

export const btcpayGateway: PaymentGateway = {
  id: "BTCPAY",
  title: "Биткоин",

  isConfigured() {
    return isBTCPayConfigured()
  },

  supportsSplit() {
    // Платёж приходит одной транзакцией в кошелёк площадки: разделить
    // его между получателями на уровне сети нельзя.
    return false
  },

  settlementAsset: "SATS",
  refundsAreManual: true,

  splitHappensWithCapture: false,
  refundReclaimsSellerShare: false,

  splitAccountOf() {
    return null
  },

  async createHold({
    purchaseId,
    productId,
    buyerId,
    amount,
    description,
    returnUrl,
  }: CreateHoldParams): Promise<CreateHoldResult> {
    const invoice = await createInvoice({
      amount,
      currency: "RUB",
      orderId: purchaseId,
      metadata: { productId, buyerId, itemDesc: description },
      redirectUrl: returnUrl,
    })

    if (!invoice.checkoutLink) {
      throw new Error(`BTCPay не вернул ссылку на оплату для ${purchaseId}`)
    }

    return { paymentId: invoice.id, confirmationUrl: invoice.checkoutLink }
  },

  async getPayment(paymentId: string): Promise<ProviderPayment> {
    return toProviderPayment(await getInvoice(paymentId))
  },

  async findPaymentByPurchase(
    purchaseId: string
  ): Promise<ProviderPayment | null> {
    const invoice = await findInvoiceByOrderId(purchaseId)
    return invoice ? toProviderPayment(invoice) : null
  },

  async capture({ purchaseId, paymentId }: CaptureParams): Promise<CaptureResult> {
    // Списывать нечего: биткоин пришёл в момент оплаты. Убеждаемся лишь,
    // что счёт действительно оплачен, — начислить выручку продавцу
    // за неподтверждённый платёж нельзя.
    const invoice = await getInvoice(paymentId)

    if (invoice.status !== "Settled") {
      console.error(
        `Покупка ${purchaseId}: счёт BTCPay в состоянии ${invoice.status}, подтверждать нечего`
      )
      return { status: toStatus(invoice), splitSettled: false }
    }

    // Доля продавца уходит на внутренний баланс в сатоши: посчитать её
    // может только сделка, ей известна и сумма частичного возврата.
    return { status: "succeeded", splitSettled: false }
  },

  async cancel(paymentId: string, purchaseId: string): Promise<ProviderPayment> {
    const invoice = await getInvoice(paymentId)

    if (isPaidStatus(invoice)) {
      // Отмена уже полученного платежа — это перевод обратно, а для него
      // нужен адрес покупателя. Такие случаи оформляются задачей
      // администратору, а не запросом к провайдеру.
      throw new Error(
        `Счёт BTCPay по покупке ${purchaseId} уже оплачен: возврат биткоина проводится вручную`
      )
    }

    if (invoice.status !== "Invalid" && invoice.status !== "Expired") {
      await markInvoiceInvalid(paymentId)
    }

    return toProviderPayment(await getInvoice(paymentId))
  },

  async refund({ purchaseId }: RefundParams): Promise<{ refundId: string | null }> {
    throw new Error(
      `Возврат по покупке ${purchaseId} в биткоинах проводится вручную`
    )
  },
}
