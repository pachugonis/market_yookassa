import { NextResponse } from "next/server"
import { configuredGateways, defaultProvider } from "@/lib/payments"
import { isCardBindingAvailable } from "@/lib/payments/card-binding"

/**
 * Способы оплаты, доступные на площадке. Список зависит от того, ключи
 * каких сервисов заданы в окружении, поэтому кнопку выбора рисуем
 * по ответу этого эндпоинта, а не по константе в интерфейсе.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      providers: configuredGateways().map((gateway) => ({
        id: gateway.id,
        title: gateway.title,
      })),
      default: defaultProvider(),
      // Привязка карты для выплат имеет смысл только при подключённом
      // терминале выплат CloudPayments.
      cardBinding: isCardBindingAvailable(),
    },
  })
}
