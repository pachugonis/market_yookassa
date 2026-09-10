import { NextResponse } from "next/server"
import { configuredGateways, defaultProvider } from "@/lib/payments"
import { isCardBindingAvailable } from "@/lib/payments/card-binding"
import { isSingleVendorMode } from "@/lib/platform-mode"

/**
 * Способы оплаты, доступные на площадке. Список зависит от того, ключи
 * каких сервисов заданы в окружении, поэтому кнопку выбора рисуем
 * по ответу этого эндпоинта, а не по константе в интерфейсе.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  // В режиме одного продавца сплитования нет, а значит карта продавца
  // никуда не участвует: предлагать её привязку не за чем.
  const singleVendor = await isSingleVendorMode()

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
      cardBinding: !singleVendor && isCardBindingAvailable(),
    },
  })
}
