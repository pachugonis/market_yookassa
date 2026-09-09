import { btcpayGateway } from "@/lib/payments/btcpay-gateway"
import { cloudpaymentsGateway } from "@/lib/payments/cloudpayments-gateway"
import { yookassaGateway } from "@/lib/payments/yookassa-gateway"
import { PROVIDER_ORDER } from "@/lib/payments/config"
import type {
  PaymentGateway,
  PaymentProviderId,
  SellerPayoutAccounts,
} from "@/lib/payments/types"

export type {
  CaptureResult,
  CreateHoldResult,
  PaymentGateway,
  PaymentProviderId,
  ProviderPayment,
  ProviderPaymentStatus,
  SellerPayoutAccounts,
  SettlementAsset,
} from "@/lib/payments/types"

const GATEWAYS: Record<PaymentProviderId, PaymentGateway> = {
  YOOKASSA: yookassaGateway,
  CLOUDPAYMENTS: cloudpaymentsGateway,
  BTCPAY: btcpayGateway,
}

export function getGateway(provider: PaymentProviderId): PaymentGateway {
  return GATEWAYS[provider]
}

export function isPaymentProviderId(
  value: unknown
): value is PaymentProviderId {
  return (
    value === "YOOKASSA" || value === "CLOUDPAYMENTS" || value === "BTCPAY"
  )
}

/** Провайдеры, ключи которых заданы в окружении. */
export function configuredGateways(): PaymentGateway[] {
  return PROVIDER_ORDER.map(getGateway).filter((gateway) =>
    gateway.isConfigured()
  )
}

/**
 * Провайдер по умолчанию: либо заданный явно в
 * PAYMENT_PROVIDER_DEFAULT, либо первый настроенный.
 */
export function defaultProvider(): PaymentProviderId | null {
  const preferred = process.env.PAYMENT_PROVIDER_DEFAULT?.trim().toUpperCase()

  if (isPaymentProviderId(preferred) && getGateway(preferred).isConfigured()) {
    return preferred
  }

  return configuredGateways()[0]?.id ?? null
}

/**
 * Провайдер для конкретной сделки. Выбор покупателя учитывается, только
 * если этот провайдер действительно настроен.
 */
export function resolveProvider(
  requested: unknown
): PaymentProviderId | null {
  if (isPaymentProviderId(requested) && getGateway(requested).isConfigured()) {
    return requested
  }

  return defaultProvider()
}

/**
 * Счёт продавца у выбранного провайдера. Пусто — сплитования не будет,
 * выручка пойдёт через внутренний баланс.
 */
export function splitAccountFor(
  provider: PaymentProviderId,
  seller: SellerPayoutAccounts
): string | null {
  const gateway = getGateway(provider)
  return gateway.supportsSplit() ? gateway.splitAccountOf(seller) : null
}
