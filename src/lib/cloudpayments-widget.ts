/**
 * Типы платёжного виджета CloudPayments.
 *
 * Виджет используется в двух местах — оплата покупки и проверочная
 * авторизация при привязке карты продавца, — поэтому объявление
 * глобального `window.cp` живёт здесь, в одном экземпляре.
 */

export const CLOUDPAYMENTS_WIDGET_SRC =
  "https://widget.cloudpayments.ru/bundles/cloudpayments.js"

export interface CloudPaymentsIntent {
  publicTerminalId: string
  amount: number
  currency: string
  culture: string
  /** Dual — двухстадийная схема: сначала заморозка, потом списание. */
  paymentSchema: "Dual" | "Single"
  description: string
  /** Номер заказа в нашей системе; приходит в уведомлениях как InvoiceId. */
  externalId: string
  successRedirectUrl?: string
  failRedirectUrl?: string
  /** Сохранить карту и вернуть её токен. */
  tokenize?: boolean
  userInfo?: { email?: string; accountId?: string }
  metadata?: Record<string, string>
  escrow?: { startAccumulation: boolean; escrowType: "OneToN" | "NToOne" }
}

export interface WidgetResult {
  type?: "payment" | "cancel" | "error" | "installment"
  status?: "success" | "fail" | "cancel" | "appointment" | "reject"
  message?: string
  data?: { transactionId?: number; ReasonCode?: number }
}

export interface CloudPaymentsWidget {
  start(intent: CloudPaymentsIntent): Promise<WidgetResult>
}

declare global {
  interface Window {
    cp?: { CloudPayments: new () => CloudPaymentsWidget }
  }
}
