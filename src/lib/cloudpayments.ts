import { createHmac, timingSafeEqual } from "crypto"
import { ipInAnyCidr, readExtraNetworks } from "@/lib/ip-allowlist"

/**
 * Клиент CloudPayments (https://developers.cloudpayments.ru).
 *
 * Здесь только транспорт и типы. Логика сделки — в
 * `src/lib/payments/cloudpayments-gateway.ts`.
 *
 * Терминалов два, как того требует «Безопасная сделка»:
 *   - терминал оплат  (CLOUDPAYMENTS_PUBLIC_ID / CLOUDPAYMENTS_API_SECRET) —
 *     авторизация, подтверждение, отмена, возврат;
 *   - терминал выплат (CLOUDPAYMENTS_PAYOUT_PUBLIC_ID /
 *     CLOUDPAYMENTS_PAYOUT_API_SECRET) — перевод доли продавцу.
 */

const CLOUDPAYMENTS_API_URL = "https://api.cloudpayments.ru"

export type CloudPaymentsTerminal = "payment" | "payout"

interface TerminalCredentials {
  publicId: string
  apiSecret: string
}

function terminalCredentials(
  terminal: CloudPaymentsTerminal
): TerminalCredentials {
  const publicId =
    terminal === "payout"
      ? process.env.CLOUDPAYMENTS_PAYOUT_PUBLIC_ID
      : process.env.CLOUDPAYMENTS_PUBLIC_ID

  const apiSecret =
    terminal === "payout"
      ? process.env.CLOUDPAYMENTS_PAYOUT_API_SECRET
      : process.env.CLOUDPAYMENTS_API_SECRET

  if (!publicId || !apiSecret) {
    throw new Error(
      terminal === "payout"
        ? "CLOUDPAYMENTS_PAYOUT_PUBLIC_ID и CLOUDPAYMENTS_PAYOUT_API_SECRET должны быть заданы в окружении"
        : "CLOUDPAYMENTS_PUBLIC_ID и CLOUDPAYMENTS_API_SECRET должны быть заданы в окружении"
    )
  }

  return { publicId, apiSecret }
}

export {
  isCloudPaymentsConfigured as isPaymentTerminalConfigured,
  isCloudPaymentsPayoutConfigured as isPayoutTerminalConfigured,
} from "@/lib/payments/config"

/** Public ID терминала оплат — он же нужен виджету на странице оплаты. */
export function paymentPublicId(): string {
  return terminalCredentials("payment").publicId
}

/**
 * Статусы транзакции CloudPayments.
 * Authorized — деньги заморожены (двухстадийная схема),
 * Completed — списаны, Cancelled/Declined — операции не будет.
 */
export type CloudPaymentsStatus =
  | "AwaitingAuthentication"
  | "Authorized"
  | "Completed"
  | "Cancelled"
  | "Declined"
  | string

export interface CloudPaymentsTransaction {
  TransactionId: number
  Amount: number
  Currency?: string
  PaymentAmount?: number
  InvoiceId?: string | null
  AccountId?: string | null
  Description?: string | null
  JsonData?: string | Record<string, unknown> | null
  Status?: CloudPaymentsStatus
  StatusCode?: number
  Reason?: string | null
  ReasonCode?: number | null
  CardHolderMessage?: string | null
  AuthDateIso?: string | null
  ConfirmDateIso?: string | null
  CreatedDateIso?: string | null
  EscrowAccumulationId?: string | null
  Token?: string | null
  CardFirstSix?: string | null
  CardLastFour?: string | null
  CardType?: string | null
  TestMode?: boolean
  Type?: number | string
  Refunded?: boolean
}

interface CloudPaymentsEnvelope<T> {
  Model?: T
  Success: boolean
  Message?: string | null
}

/** Ошибка API CloudPayments с сохранённым HTTP-статусом и телом ответа. */
export class CloudPaymentsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
    this.name = "CloudPaymentsError"
  }
}

/**
 * Запрос к API. `requestId` включает идемпотентность: CloudPayments хранит
 * результат обработанного X-Request-ID час, поэтому повтор после таймаута
 * не создаёт вторую операцию.
 */
async function request<T>(
  path: string,
  body: unknown,
  {
    terminal = "payment",
    requestId,
  }: { terminal?: CloudPaymentsTerminal; requestId?: string } = {}
): Promise<CloudPaymentsEnvelope<T>> {
  const { publicId, apiSecret } = terminalCredentials(terminal)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${publicId}:${apiSecret}`).toString("base64")}`,
  }

  if (requestId) headers["X-Request-ID"] = requestId

  const response = await fetch(`${CLOUDPAYMENTS_API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  })

  const text = await response.text()
  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    console.error(`CloudPayments POST ${path} failed:`, payload)
    throw new CloudPaymentsError(
      `CloudPayments request failed: ${response.status}`,
      response.status,
      payload
    )
  }

  return payload as CloudPaymentsEnvelope<T>
}

/**
 * Success: false — это не транспортная ошибка, а отказ по существу
 * (нет денег на карте, операция уже отменена и т.п.). Для вызывающего
 * кода разницы нет: операция не прошла.
 */
function unwrap<T>(envelope: CloudPaymentsEnvelope<T>, path: string): T {
  if (!envelope?.Success) {
    throw new CloudPaymentsError(
      `CloudPayments ${path} declined: ${envelope?.Message ?? "unknown reason"}`,
      200,
      envelope
    )
  }

  return envelope.Model as T
}

/** Подтверждение двухстадийного платежа: замороженные средства списываются. */
export async function confirmPayment(
  transactionId: number,
  amount: number,
  requestId?: string
): Promise<void> {
  const envelope = await request<unknown>(
    "/payments/confirm",
    { TransactionId: transactionId, Amount: amount },
    { requestId }
  )

  if (!envelope?.Success) {
    throw new CloudPaymentsError(
      `CloudPayments confirm declined: ${envelope?.Message ?? "unknown reason"}`,
      200,
      envelope
    )
  }
}

/** Снятие холда: деньги разблокируются на карте покупателя. */
export async function voidPayment(
  transactionId: number,
  requestId?: string
): Promise<void> {
  const envelope = await request<unknown>(
    "/payments/void",
    { TransactionId: transactionId },
    { requestId }
  )

  if (!envelope?.Success) {
    throw new CloudPaymentsError(
      `CloudPayments void declined: ${envelope?.Message ?? "unknown reason"}`,
      200,
      envelope
    )
  }
}

/** Возврат уже списанных денег (полный или частичный). */
export async function refundPayment(
  transactionId: number,
  amount: number,
  requestId?: string
): Promise<{ TransactionId: number } | null> {
  const envelope = await request<{ TransactionId: number }>(
    "/payments/refund",
    { TransactionId: transactionId, Amount: amount },
    { requestId }
  )

  if (!envelope?.Success) {
    throw new CloudPaymentsError(
      `CloudPayments refund declined: ${envelope?.Message ?? "unknown reason"}`,
      200,
      envelope
    )
  }

  return envelope.Model ?? null
}

/** Детализация по транзакции. */
export async function getTransaction(
  transactionId: number
): Promise<CloudPaymentsTransaction> {
  const envelope = await request<CloudPaymentsTransaction>("/payments/get", {
    TransactionId: transactionId,
  })

  return unwrap(envelope, "payments/get")
}

/**
 * Поиск последней операции по номеру заказа. Нужен там, где транзакция
 * ещё не связана с покупкой: виджет открывается на клиенте, и её номер
 * приходит только с уведомлением.
 *
 * Ненайденный платёж — это не ошибка: покупатель мог просто закрыть
 * виджет, не начав оплату.
 */
export async function findTransactionByInvoice(
  invoiceId: string
): Promise<CloudPaymentsTransaction | null> {
  const envelope = await request<CloudPaymentsTransaction>(
    "/v2/payments/find",
    { InvoiceId: invoiceId }
  )

  if (!envelope?.Success || !envelope.Model) return null
  return envelope.Model
}

export interface EscrowPayoutParams {
  /** Токен карты продавца, полученный при оплате картой. */
  token: string
  amount: number
  /** Идентификатор продавца в нашей системе. */
  accountId: string
  invoiceId: string
  accumulationId: string
  /** Транзакция оплаты, из которой делается выплата. */
  transactionIds: number[]
  /** true — сделка закрывается, даже если выплата меньше суммы оплаты. */
  finalPayout?: boolean
  requestId?: string
}

/**
 * Выплата продавцу по «Безопасной сделке» (схема 1:N).
 *
 * Именно она заменяет сплитование ЮKassa: из накопления, созданного
 * платежом покупателя, доля продавца уходит на его карту, а комиссия
 * площадки остаётся на терминале оплат.
 */
export async function payoutByToken({
  token,
  amount,
  accountId,
  invoiceId,
  accumulationId,
  transactionIds,
  finalPayout = true,
  requestId,
}: EscrowPayoutParams): Promise<CloudPaymentsTransaction> {
  const envelope = await request<CloudPaymentsTransaction>(
    "/payments/token/topup",
    {
      Token: token,
      Amount: amount,
      AccountId: accountId,
      Currency: "RUB",
      InvoiceId: invoiceId,
      Escrow: {
        AccumulationId: accumulationId,
        TransactionIds: transactionIds,
        EscrowType: "OneToN",
        FinalPayout: finalPayout,
      },
    },
    { terminal: "payout", requestId }
  )

  return unwrap(envelope, "payments/token/topup")
}

/**
 * Официальные адреса, с которых CloudPayments шлёт уведомления.
 * https://developers.cloudpayments.ru — раздел «Проверка уведомлений».
 */
const CLOUDPAYMENTS_NETWORKS = [
  "185.98.81.0/28",
  "87.251.91.160/27",
  "46.46.175.96/27",
  "46.46.168.160/27",
  "162.55.174.97/32",
  "91.216.178.243/32",
]

/**
 * Проверяет, что уведомление пришло с адреса CloudPayments.
 * Дополнительные сети задаются через CLOUDPAYMENTS_ALLOWED_IPS
 * (список CIDR через запятую).
 */
export function isTrustedCloudPaymentsIp(ip: string): boolean {
  return ipInAnyCidr(ip, [
    ...CLOUDPAYMENTS_NETWORKS,
    ...readExtraNetworks(process.env.CLOUDPAYMENTS_ALLOWED_IPS),
  ])
}

/**
 * Проверка подписи уведомления: HMAC-SHA256 от «сырого» тела запроса,
 * ключ — API Secret терминала, результат в base64.
 *
 * Заголовков два: Content-HMAC считается по URL-encoded параметрам,
 * X-Content-HMAC — по декодированным. Тело мы читаем как есть, поэтому
 * принимаем совпадение с любым из них.
 */
export function verifyNotificationSignature(
  rawBody: string,
  headers: { contentHmac?: string | null; xContentHmac?: string | null },
  terminal: CloudPaymentsTerminal = "payment"
): boolean {
  const { apiSecret } = terminalCredentials(terminal)

  const expected = createHmac("sha256", apiSecret)
    .update(rawBody, "utf8")
    .digest("base64")

  return [headers.contentHmac, headers.xContentHmac].some((provided) =>
    provided ? equalsConstantTime(provided.trim(), expected) : false
  )
}

function equalsConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")

  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Тело уведомления. Формат задаётся в личном кабинете: по умолчанию
 * form-urlencoded, но может быть и JSON — разбираем оба.
 */
export function parseNotification(
  rawBody: string,
  contentType: string | null
): Record<string, string> {
  if (contentType?.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        ])
      )
    } catch {
      return {}
    }
  }

  return Object.fromEntries(new URLSearchParams(rawBody).entries())
}
