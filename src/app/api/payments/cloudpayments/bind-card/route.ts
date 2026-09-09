import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import {
  isCardBindingAvailable,
  startCardBinding,
  unbindCard,
} from "@/lib/payments/card-binding"

/**
 * Привязка и отвязка карты продавца для выплат CloudPayments.
 *
 * POST начинает проверочную авторизацию: возвращает параметры виджета,
 * который откроется у продавца. Секретов в них нет — только публичный
 * идентификатор терминала и номер заказа привязки.
 */

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 }
    )
  }

  if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Карта для выплат доступна только продавцам" },
      { status: 403 }
    )
  }

  if (!isCardBindingAvailable()) {
    return NextResponse.json(
      {
        success: false,
        error: "Выплаты через CloudPayments не подключены на площадке",
      },
      { status: 503 }
    )
  }

  // Каждая попытка — это авторизация на карте, поэтому запускать их
  // пачками незачем.
  const limit = rateLimit(`bind-card:${session.user.id}`, 5, 10 * 60 * 1000)

  if (!limit.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} с`,
      },
      { status: 429 }
    )
  }

  try {
    const intent = await startCardBinding(session.user.id)
    return NextResponse.json({ success: true, data: intent })
  } catch (error) {
    console.error("Error starting card binding:", error)
    return NextResponse.json(
      { success: false, error: "Не удалось начать привязку карты" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 }
    )
  }

  try {
    await unbindCard(session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error unbinding card:", error)
    return NextResponse.json(
      { success: false, error: "Не удалось отвязать карту" },
      { status: 500 }
    )
  }
}
