import { v4 as uuidv4 } from "uuid"
import { ipInAnyCidr, readExtraNetworks } from "@/lib/ip-allowlist"

const YOOKASSA_API_URL = "https://api.yookassa.ru/v3"

function credentials(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY

  if (!shopId || !secretKey) {
    throw new Error(
      "YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY должны быть заданы в окружении"
    )
  }

  return Buffer.from(`${shopId}:${secretKey}`).toString("base64")
}

export interface YooKassaAmount {
  value: string
  currency: string
}

/**
 * Элемент сплитования («ЮKassa для платформ»).
 *
 * `amount` — сумма, перечисляемая продавцу, ВКЛЮЧАЯ комиссию площадки;
 * сумма всех transfers должна совпадать с суммой платежа.
 * `platform_fee_amount` — часть этой суммы, удерживаемая площадкой.
 * То есть продавец получает `amount - platform_fee_amount`.
 */
export interface YooKassaTransfer {
  account_id: string
  amount: YooKassaAmount
  platform_fee_amount?: YooKassaAmount
  status?: string
}

interface CreatePaymentParams {
  amount: number
  description: string
  returnUrl: string
  metadata?: Record<string, string>
  /**
   * false — двухэтапный платёж: средства только замораживаются и ждут
   * подтверждения (capture). Значение по умолчанию: сделка на площадке
   * подтверждается покупателем, а не в момент оплаты.
   */
  capture?: boolean
  transfers?: YooKassaTransfer[]
  /** Ключ идемпотентности. Должен быть стабильным для повторов. */
  idempotenceKey?: string
}

export interface YooKassaPayment {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  paid?: boolean
  confirmation?: {
    type: string
    confirmation_url: string
  }
  amount: YooKassaAmount
  income_amount?: YooKassaAmount
  refunded_amount?: YooKassaAmount
  /** Момент, до которого действует холд. Дальше ЮKassa снимет его сама. */
  expires_at?: string
  captured_at?: string
  transfers?: YooKassaTransfer[]
  cancellation_details?: {
    party?: string
    reason?: string
  }
  metadata?: Record<string, string>
}

export interface YooKassaRefund {
  id: string
  status: "pending" | "succeeded" | "canceled"
  payment_id: string
  amount: YooKassaAmount
}

/** Ошибка API ЮKassa с сохранённым HTTP-статусом и телом ответа. */
export class YooKassaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
    this.name = "YooKassaError"
  }
}

function amountOf(value: number): YooKassaAmount {
  return { value: value.toFixed(2), currency: "RUB" }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotenceKey?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${credentials()}`,
  }

  if (init.method && init.method !== "GET") {
    headers["Content-Type"] = "application/json"
    // ЮKassa требует ключ идемпотентности на всех изменяющих запросах.
    // Стабильный ключ превращает повтор после таймаута в тот же самый
    // платёж, а не во второй.
    headers["Idempotence-Key"] = init.idempotenceKey ?? uuidv4()
  }

  const response = await fetch(`${YOOKASSA_API_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
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
    console.error(`YooKassa ${init.method ?? "GET"} ${path} failed:`, payload)
    throw new YooKassaError(
      `YooKassa request failed: ${response.status}`,
      response.status,
      payload
    )
  }

  return payload as T
}

export async function createPayment({
  amount,
  description,
  returnUrl,
  metadata,
  capture = false,
  transfers,
  idempotenceKey,
}: CreatePaymentParams): Promise<YooKassaPayment> {
  return request<YooKassaPayment>("/payments", {
    method: "POST",
    idempotenceKey,
    body: {
      amount: amountOf(amount),
      confirmation: {
        type: "redirect",
        return_url: returnUrl,
      },
      capture,
      description,
      metadata,
      ...(transfers && transfers.length > 0 ? { transfers } : {}),
    },
  })
}

export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  return request<YooKassaPayment>(`/payments/${encodeURIComponent(paymentId)}`)
}

/**
 * Подтверждение платежа (шаг 3 сделки): замороженные средства
 * списываются и распределяются по transfers.
 *
 * Если передать сумму меньше захолдированной, ЮKassa спишет только её,
 * а разницу вернёт покупателю — так делается частичный возврат по спору.
 */
export async function capturePayment(
  paymentId: string,
  {
    amount,
    transfers,
    idempotenceKey,
  }: { amount: number; transfers?: YooKassaTransfer[]; idempotenceKey: string }
): Promise<YooKassaPayment> {
  return request<YooKassaPayment>(
    `/payments/${encodeURIComponent(paymentId)}/capture`,
    {
      method: "POST",
      idempotenceKey,
      body: {
        amount: amountOf(amount),
        ...(transfers && transfers.length > 0 ? { transfers } : {}),
      },
    }
  )
}

/** Снятие холда: деньги разблокируются на карте покупателя. */
export async function cancelPayment(
  paymentId: string,
  idempotenceKey: string
): Promise<YooKassaPayment> {
  return request<YooKassaPayment>(
    `/payments/${encodeURIComponent(paymentId)}/cancel`,
    { method: "POST", idempotenceKey, body: {} }
  )
}

/**
 * Возврат уже списанных денег. Для сплитованного платежа нужно указать
 * sources — с каких счетов забирать: деньги снимаются со счёта продавца,
 * а удержанная площадкой комиссия возвращается пропорционально.
 */
export async function createRefund({
  paymentId,
  amount,
  sources,
  description,
  idempotenceKey,
}: {
  paymentId: string
  amount: number
  sources?: YooKassaTransfer[]
  description?: string
  idempotenceKey: string
}): Promise<YooKassaRefund> {
  return request<YooKassaRefund>("/refunds", {
    method: "POST",
    idempotenceKey,
    body: {
      payment_id: paymentId,
      amount: amountOf(amount),
      ...(sources && sources.length > 0 ? { sources } : {}),
      ...(description ? { description } : {}),
    },
  })
}

/**
 * Сплит на одного продавца: вся сумма сделки уходит на его счёт,
 * комиссия площадки удерживается из неё.
 */
export function buildTransfers({
  accountId,
  amount,
  commission,
}: {
  accountId: string
  amount: number
  commission: number
}): YooKassaTransfer[] {
  return [
    {
      account_id: accountId,
      amount: amountOf(amount),
      platform_fee_amount: amountOf(commission),
    },
  ]
}

/**
 * Официальные адреса, с которых ЮKassa шлёт уведомления.
 * https://yookassa.ru/developers/using-api/webhooks
 */
const YOOKASSA_NETWORKS = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
]

/**
 * Проверяет, что уведомление пришло с адреса ЮKassa.
 * Дополнительные сети можно задать через YOOKASSA_ALLOWED_IPS
 * (список CIDR через запятую) — например, для стенда.
 */
export function isTrustedYooKassaIp(ip: string): boolean {
  return ipInAnyCidr(ip, [
    ...YOOKASSA_NETWORKS,
    ...readExtraNetworks(process.env.YOOKASSA_ALLOWED_IPS),
  ])
}

const DEFAULT_COMMISSION_RATE = 10

/**
 * Комиссия площадки. При сплитовании ровно это значение уходит
 * в platform_fee_amount, поэтому считать её нужно в одном месте.
 */
export function calculateCommission(
  amount: number,
  ratePercent: number = DEFAULT_COMMISSION_RATE
): {
  commission: number
  sellerEarnings: number
} {
  const rate = Number.isFinite(ratePercent) ? ratePercent : DEFAULT_COMMISSION_RATE
  const bounded = Math.min(Math.max(rate, 0), 100)
  const commission = Math.round((amount * bounded) / 100)
  const sellerEarnings = amount - commission
  return { commission, sellerEarnings }
}
