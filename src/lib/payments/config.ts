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

/** Порядок определяет и выбор по умолчанию, и порядок в интерфейсе. */
export const PROVIDER_ORDER: PaymentProviderId[] = [
  "YOOKASSA",
  "CLOUDPAYMENTS",
]

export function isProviderConfigured(provider: PaymentProviderId): boolean {
  return provider === "YOOKASSA"
    ? isYooKassaConfigured()
    : isCloudPaymentsConfigured()
}

export function configuredProviderIds(): PaymentProviderId[] {
  return PROVIDER_ORDER.filter(isProviderConfigured)
}
