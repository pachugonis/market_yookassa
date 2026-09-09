import { createHmac, timingSafeEqual } from "crypto"

/**
 * Клиент BTCPay Server (Greenfield API).
 *
 * Здесь только транспорт и типы. Логика сделки — в
 * `src/lib/payments/btcpay-gateway.ts`, выплаты — в
 * `src/lib/payments/btc-payouts.ts`.
 *
 * BTCPay — не эквайер: у него нет ни платформенных счетов, ни
 * сплитования. Весь платёж приходит в кошелёк площадки, поэтому доля
 * продавца живёт на внутреннем балансе в сатоши, а выводится отдельной
 * транзакцией.
 */

const SATS_IN_BTC = 100_000_000

/** Сколько живёт счёт на оплату. Дольше держать бессмысленно: курс уедет. */
const INVOICE_EXPIRATION_MINUTES = readPositiveNumber(
  process.env.BTCPAY_INVOICE_EXPIRATION_MINUTES,
  30
)

/**
 * Сколько подтверждений сети ждать, прежде чем считать счёт оплаченным.
 * MediumSpeed — одно подтверждение: платёж уже нельзя переписать через
 * RBF, а покупатель ждёт около десяти минут.
 */
const SPEED_POLICY = process.env.BTCPAY_SPEED_POLICY || "MediumSpeed"

function readPositiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

// Проверка окружения живёт в config.ts: её вызывает и middleware,
// куда нельзя тащить зависимость от `crypto`.
export { isBTCPayConfigured } from "@/lib/payments/config"

interface BTCPayCredentials {
  baseUrl: string
  apiKey: string
  storeId: string
}

function credentials(): BTCPayCredentials {
  const baseUrl = process.env.BTCPAY_URL?.replace(/\/+$/, "")
  const apiKey = process.env.BTCPAY_API_KEY
  const storeId = process.env.BTCPAY_STORE_ID

  if (!baseUrl || !apiKey || !storeId) {
    throw new Error(
      "BTCPAY_URL, BTCPAY_API_KEY и BTCPAY_STORE_ID должны быть заданы в окружении"
    )
  }

  return { baseUrl, apiKey, storeId }
}

/** Идентификатор магазина — нужен ссылкам в админку. */
export function storeId(): string {
  return credentials().storeId
}

/** Адрес сервера — по нему администратор открывает выплату для подписи. */
export function serverUrl(): string {
  return credentials().baseUrl
}

/** Статусы счёта в BTCPay. */
export type BTCPayInvoiceStatus =
  | "New"
  | "Processing"
  | "Expired"
  | "Invalid"
  | "Settled"
  | string

export interface BTCPayInvoice {
  id: string
  storeId?: string
  amount: string
  currency: string
  status: BTCPayInvoiceStatus
  additionalStatus?: string
  checkoutLink?: string
  expirationTime?: number
  createdTime?: number
  metadata?: Record<string, unknown> | null
}

/**
 * Способ оплаты счёта вместе с тем, сколько по нему пришло.
 * `rate` — курс фиата за 1 BTC на момент выставления счёта.
 */
export interface BTCPayInvoicePaymentMethod {
  paymentMethodId?: string
  paymentMethod?: string
  cryptoCode?: string
  currency?: string
  rate?: string
  amount?: string
  paid?: string
  totalPaid?: string
  due?: string
  destination?: string
  payments?: Array<{
    id?: string
    value?: string
    fee?: string
    status?: string
    receivedDate?: number
  }>
}

/** Состояние выплаты в BTCPay. */
export type BTCPayPayoutState =
  | "AwaitingApproval"
  | "AwaitingPayment"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | string

export interface BTCPayPayout {
  id: string
  state: BTCPayPayoutState
  destination?: string
  amount?: string
  originalAmount?: string
  payoutMethodId?: string
  paymentMethod?: string
  paymentProof?: {
    id?: string
    proofType?: string
    link?: string
  } | null
}

export class BTCPayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
    this.name = "BTCPayError"
  }
}

async function request<T>(
  path: string,
  {
    method = "GET",
    body,
  }: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const { baseUrl, apiKey } = credentials()

  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${apiKey}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
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
    console.error(`BTCPay ${method} ${path} failed:`, payload)
    throw new BTCPayError(
      `BTCPay request failed: ${response.status}`,
      response.status,
      payload
    )
  }

  return payload as T
}

/**
 * Счёт на оплату. Сумма выставляется в рублях — курс считает сам
 * BTCPay по источнику, настроенному в магазине, и фиксирует его
 * на время жизни счёта.
 */
export async function createInvoice({
  amount,
  currency = "RUB",
  metadata,
  redirectUrl,
  orderId,
}: {
  /** Сумма в рублях (не в копейках). */
  amount: number
  currency?: string
  metadata?: Record<string, unknown>
  redirectUrl: string
  orderId: string
}): Promise<BTCPayInvoice> {
  const { storeId } = credentials()

  return request<BTCPayInvoice>(`/stores/${storeId}/invoices`, {
    method: "POST",
    body: {
      amount: amount.toFixed(2),
      currency,
      metadata: { orderId, ...metadata },
      checkout: {
        redirectURL: redirectUrl,
        redirectAutomatically: true,
        expirationMinutes: INVOICE_EXPIRATION_MINUTES,
        speedPolicy: SPEED_POLICY,
        defaultLanguage: "ru-RU",
      },
    },
  })
}

export async function getInvoice(invoiceId: string): Promise<BTCPayInvoice> {
  const { storeId } = credentials()
  return request<BTCPayInvoice>(
    `/stores/${storeId}/invoices/${encodeURIComponent(invoiceId)}`
  )
}

/**
 * Поиск счёта по номеру заказа. Нужен там, где идентификатор счёта
 * до нас не дошёл: покупатель вернулся с оплаты раньше, чем ответ
 * на создание счёта был сохранён.
 */
export async function findInvoiceByOrderId(
  orderId: string
): Promise<BTCPayInvoice | null> {
  const { storeId } = credentials()

  const invoices = await request<BTCPayInvoice[]>(
    `/stores/${storeId}/invoices?orderId=${encodeURIComponent(orderId)}`
  )

  if (!Array.isArray(invoices) || invoices.length === 0) return null

  // Оплаченный счёт важнее свежего: покупатель мог открыть оплату дважды.
  return (
    invoices.find((invoice) => invoice.status === "Settled") ??
    invoices.find((invoice) => invoice.status === "Processing") ??
    invoices[0]
  )
}

/** Сколько по счёту пришло на самом деле и по какому курсу. */
export async function getInvoicePaymentMethods(
  invoiceId: string
): Promise<BTCPayInvoicePaymentMethod[]> {
  const { storeId } = credentials()
  return request<BTCPayInvoicePaymentMethod[]>(
    `/stores/${storeId}/invoices/${encodeURIComponent(invoiceId)}/payment-methods`
  )
}

/**
 * Пометить счёт недействительным. Работает только для неоплаченного:
 * полученный биткоин отменой не возвращается.
 */
export async function markInvoiceInvalid(
  invoiceId: string
): Promise<BTCPayInvoice> {
  const { storeId } = credentials()
  return request<BTCPayInvoice>(
    `/stores/${storeId}/invoices/${encodeURIComponent(invoiceId)}/status`,
    { method: "POST", body: { status: "Invalid" } }
  )
}

/**
 * Оценка ставки комиссии в сатоши на виртуальный байт.
 *
 * Путь к кошельковым эндпоинтам различается между версиями BTCPay:
 * до 2.0 способ оплаты адресуется как `onchain/BTC`, после — как
 * `BTC-CHAIN`. Пробуем оба, чтобы не привязываться к версии сервера.
 */
export async function getFeeRate(blockTarget: number): Promise<number> {
  const { storeId } = credentials()
  const query = `?blockTarget=${Math.max(1, Math.round(blockTarget))}`

  const paths = [
    `/stores/${storeId}/payment-methods/onchain/BTC/wallet/feerate${query}`,
    `/stores/${storeId}/payment-methods/BTC-CHAIN/wallet/feerate${query}`,
  ]

  let lastError: unknown = null

  for (const path of paths) {
    try {
      const result = await request<{ feeRate: number | string }>(path)
      const rate = Number(result?.feeRate)

      if (Number.isFinite(rate) && rate > 0) return rate
    } catch (error) {
      if (error instanceof BTCPayError && error.status === 404) {
        lastError = error
        continue
      }
      throw error
    }
  }

  throw new BTCPayError(
    "BTCPay не вернул оценку комиссии сети",
    404,
    lastError
  )
}

/**
 * Заявка на выплату. `approved: false` — деньги не уходят сами:
 * администратор одобряет и подписывает транзакцию в BTCPay, ключи
 * остаются вне приложения.
 */
export async function createPayout({
  destination,
  amountSats,
}: {
  destination: string
  amountSats: number
}): Promise<BTCPayPayout> {
  const { storeId } = credentials()
  const amount = satsToBtc(amountSats)

  // Имя поля со способом выплаты тоже менялось между версиями.
  const bodies = [
    { destination, amount, payoutMethodId: "BTC-CHAIN", approved: false },
    { destination, amount, paymentMethod: "BTC", approved: false },
  ]

  let lastError: unknown = null

  for (const body of bodies) {
    try {
      return await request<BTCPayPayout>(`/stores/${storeId}/payouts`, {
        method: "POST",
        body,
      })
    } catch (error) {
      // 400/422 здесь означает «сервер не понял способ выплаты»;
      // отказ по существу (мало средств, плохой адрес) приходит с тем же
      // кодом, поэтому второй вариант — последняя попытка, а не цикл.
      if (
        error instanceof BTCPayError &&
        (error.status === 400 || error.status === 422)
      ) {
        lastError = error
        continue
      }
      throw error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new BTCPayError("BTCPay отклонил заявку на выплату", 400, lastError)
}

export async function getPayout(payoutId: string): Promise<BTCPayPayout> {
  const { storeId } = credentials()
  return request<BTCPayPayout>(
    `/stores/${storeId}/payouts/${encodeURIComponent(payoutId)}`
  )
}

/** Отмена заявки, пока она не подписана. */
export async function cancelPayout(payoutId: string): Promise<void> {
  const { storeId } = credentials()
  await request<unknown>(
    `/stores/${storeId}/payouts/${encodeURIComponent(payoutId)}`,
    { method: "DELETE" }
  )
}

/**
 * Подпись уведомления: HMAC-SHA256 от «сырого» тела, ключ — секрет
 * вебхука, результат в hex с префиксом `sha256=`.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.BTCPAY_WEBHOOK_SECRET

  if (!secret || !signature) return false

  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")

  const provided = Buffer.from(signature.trim(), "utf8")
  const wanted = Buffer.from(expected, "utf8")

  if (provided.length !== wanted.length) return false
  return timingSafeEqual(provided, wanted)
}

/**
 * BTC → сатоши без промежуточного float: значение приходит десятичной
 * строкой, и округление на восьмом знаке искажало бы суммы.
 */
export function btcToSats(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0

  const raw = typeof value === "number" ? value.toFixed(8) : value.trim()

  if (!/^-?\d*(\.\d*)?$/.test(raw) || raw === "" || raw === "-") return 0

  const negative = raw.startsWith("-")
  const [whole, fraction = ""] = raw.replace("-", "").split(".")
  const sats =
    BigInt(whole || "0") * BigInt(SATS_IN_BTC) +
    BigInt(fraction.padEnd(8, "0").slice(0, 8) || "0")

  return Number(negative ? -sats : sats)
}

/** Сатоши → строка BTC с восемью знаками: в таком виде их ждёт API. */
export function satsToBtc(sats: number): string {
  const rounded = Math.round(sats)
  const negative = rounded < 0
  const value = Math.abs(rounded).toString().padStart(9, "0")
  const btc = `${value.slice(0, -8)}.${value.slice(-8)}`

  return negative ? `-${btc}` : btc
}

/**
 * Проверка биткоин-адреса. Полная валидация с контрольной суммой
 * требовала бы зависимости; здесь отсекается заведомо чужое — опечатки
 * и адреса других сетей. Окончательную проверку делает BTCPay, когда
 * принимает заявку на выплату.
 */
export function isValidBitcoinAddress(address: string): boolean {
  const value = address.trim()

  // bech32/bech32m: bc1… (mainnet), tb1…/bcrt1… (тестовые сети)
  if (/^(bc1|tb1|bcrt1)[023456789acdefghjklmnpqrstuvwxyz]{6,87}$/.test(value)) {
    return true
  }

  // base58: P2PKH (1…, m…, n…) и P2SH (3…, 2…)
  return /^[123mn2][1-9A-HJ-NP-Za-km-z]{25,39}$/.test(value)
}
