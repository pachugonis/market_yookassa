import type { PaymentProviderId } from "@/lib/payments/types"

/**
 * Какие платёжные сервисы настроены.
 *
 * Вынесено отдельно от шлюзов намеренно: проверку окружения делает и
 * `src/lib/auth.ts`, который попадает в Edge-бандл middleware, а туда
 * нельзя тащить клиенты провайдеров вместе с их зависимостями от
 * Node-модулей (`crypto`).
 */

export function isYooKassaConfigured(): boolean {
  return Boolean(
    process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY
  )
}

/** Терминал оплат CloudPayments. */
export function isCloudPaymentsConfigured(): boolean {
  return Boolean(
    process.env.CLOUDPAYMENTS_PUBLIC_ID && process.env.CLOUDPAYMENTS_API_SECRET
  )
}

/** Терминал выплат CloudPayments — без него нет сплитования. */
export function isCloudPaymentsPayoutConfigured(): boolean {
  return Boolean(
    process.env.CLOUDPAYMENTS_PAYOUT_PUBLIC_ID &&
      process.env.CLOUDPAYMENTS_PAYOUT_API_SECRET
  )
}

/**
 * BTCPay Server: приём биткоина. Секрет вебхука в проверку не входит —
 * без него оплата работает, просто состояние счёта приходится
 * перечитывать самим.
 */
export function isBTCPayConfigured(): boolean {
  return Boolean(
    process.env.BTCPAY_URL &&
      process.env.BTCPAY_API_KEY &&
      process.env.BTCPAY_STORE_ID
  )
}

/** Порядок определяет и выбор по умолчанию, и порядок в интерфейсе. */
export const PROVIDER_ORDER: PaymentProviderId[] = [
  "YOOKASSA",
  "CLOUDPAYMENTS",
  "BTCPAY",
]

export function isProviderConfigured(provider: PaymentProviderId): boolean {
  switch (provider) {
    case "YOOKASSA":
      return isYooKassaConfigured()
    case "CLOUDPAYMENTS":
      return isCloudPaymentsConfigured()
    case "BTCPAY":
      return isBTCPayConfigured()
  }
}

export function configuredProviderIds(): PaymentProviderId[] {
  return PROVIDER_ORDER.filter(isProviderConfigured)
}
