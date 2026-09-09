/**
 * Провайдер-независимый интерфейс платёжного сервиса.
 *
 * Сделка на площадке всегда живёт по одной схеме — холд, передача товара,
 * подтверждение со сплитованием — но выполняют её разные сервисы. Всё,
 * что различается, спрятано за этим интерфейсом; логика сделки
 * (`src/lib/purchase-fulfillment.ts`) о конкретном провайдере не знает.
 */

export type PaymentProviderId = "YOOKASSA" | "CLOUDPAYMENTS"

/**
 * Состояние платежа в терминах сделки, а не провайдера:
 * pending — покупатель ещё не оплатил;
 * waiting_for_capture — средства заморожены и ждут подтверждения;
 * succeeded — списаны; canceled — холд снят или платёж отклонён.
 */
export type ProviderPaymentStatus =
  | "pending"
  | "waiting_for_capture"
  | "succeeded"
  | "canceled"

export interface ProviderPayment {
  provider: PaymentProviderId
  /** Идентификатор платежа у провайдера. */
  id: string
  status: ProviderPaymentStatus
  /** Сумма платежа в рублях. */
  amount: number
  /** Сколько уже вернулось покупателю, в рублях. */
  refundedAmount: number
  /** Момент, после которого холд снимается сам. */
  expiresAt: Date | null
  /** Покупка, к которой платёж относится (из метаданных провайдера). */
  purchaseId: string | null
  /** Накопление «Безопасной сделки» CloudPayments, если оно создано. */
  accumulationId?: string | null
}

/** Реквизиты продавца у каждого из провайдеров. */
export interface SellerPayoutAccounts {
  yookassaAccountId?: string | null
  cloudpaymentsPayoutToken?: string | null
}

export interface CreateHoldParams {
  purchaseId: string
  productId: string
  buyerId: string
  amount: number
  commission: number
  description: string
  returnUrl: string
  /** Счёт продавца у этого провайдера. null — сплитования не будет. */
  splitAccountId: string | null
}

export interface CreateHoldResult {
  /**
   * Идентификатор платежа, если он известен сразу. У CloudPayments
   * оплата начинается в виджете на стороне покупателя, поэтому номер
   * транзакции приходит позже — с уведомлением.
   */
  paymentId: string | null
  /** Куда отправить покупателя, чтобы он оплатил. */
  confirmationUrl: string
}

export interface CaptureParams {
  purchaseId: string
  paymentId: string
  /** Списываемая сумма: меньше холда — частичный возврат по спору. */
  amount: number
  /** Комиссия площадки с этой суммы. */
  commission: number
  splitAccountId: string | null
  /** Продавец — получатель выплаты (нужен CloudPayments). */
  sellerId: string
  accumulationId?: string | null
}

export interface CaptureResult {
  status: ProviderPaymentStatus
  /**
   * Доля продавца уже ушла на его счёт. Если false — деньги остались
   * у площадки и должны быть начислены на внутренний баланс продавца.
   */
  splitSettled: boolean
  /** Транзакция выплаты продавцу, если она была отдельной операцией. */
  splitPayoutId?: string | null
}

export interface RefundParams {
  purchaseId: string
  paymentId: string
  amount: number
  /** Часть комиссии площадки, возвращаемая вместе с суммой. */
  commission: number
  splitAccountId: string | null
  /** Сколько уже возвращено — для ключа идемпотентности. */
  alreadyRefunded: number
}

export interface PaymentGateway {
  readonly id: PaymentProviderId
  /** Название для интерфейса покупателя. */
  readonly title: string

  /** Заданы ли ключи в окружении. */
  isConfigured(): boolean

  /** Умеет ли провайдер разводить деньги по счетам продавцов. */
  supportsSplit(): boolean

  /**
   * Уходит ли доля продавца на его счёт самим подтверждением платежа.
   * У ЮKassa — да (transfers внутри capture), у CloudPayments выплата
   * из накопления делается отдельной операцией. От этого зависит, что
   * считать сплитованным, когда о списании мы узнали не от себя.
   */
  readonly splitHappensWithCapture: boolean

  /**
   * Забирает ли возврат долю продавца с его счёта у провайдера.
   * ЮKassa умеет (`sources` в запросе возврата), CloudPayments — нет:
   * там деньги возвращаются с терминала площадки, а долг продавца
   * приходится держать на внутреннем балансе.
   */
  readonly refundReclaimsSellerShare: boolean

  /** Счёт продавца у этого провайдера, если он его указал. */
  splitAccountOf(seller: SellerPayoutAccounts): string | null

  createHold(params: CreateHoldParams): Promise<CreateHoldResult>

  getPayment(paymentId: string): Promise<ProviderPayment>

  /**
   * Найти платёж по идентификатору покупки. Нужен там, где номер
   * транзакции мог не дойти до нас. null — платежа нет.
   */
  findPaymentByPurchase(purchaseId: string): Promise<ProviderPayment | null>

  capture(params: CaptureParams): Promise<CaptureResult>

  /** Снятие холда. Возвращает состояние платежа после операции. */
  cancel(paymentId: string, purchaseId: string): Promise<ProviderPayment>

  /**
   * Возврат уже списанных денег. Бросает исключение, если не удался.
   * Возвращает идентификатор операции возврата, если провайдер его даёт.
   */
  refund(params: RefundParams): Promise<{ refundId: string | null }>
}
