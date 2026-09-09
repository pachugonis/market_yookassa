import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  completeCardBinding,
  findPendingBinding,
} from "@/lib/payments/card-binding"

/**
 * Завершение привязки по результату виджета.
 *
 * Дублирует уведомление CloudPayments: продавец не должен ждать
 * вебхука, чтобы увидеть привязанную карту. Обе дороги идемпотентны,
 * токен сохраняется один раз.
 */

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 }
    )
  }

  let body: { bindingId?: unknown; transactionId?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Некорректный запрос" },
      { status: 400 }
    )
  }

  const bindingId = typeof body.bindingId === "string" ? body.bindingId : null
  const transactionId =
    typeof body.transactionId === "string"
      ? body.transactionId
      : typeof body.transactionId === "number"
        ? String(body.transactionId)
        : null

  if (!bindingId || !transactionId) {
    return NextResponse.json(
      { success: false, error: "Не указана привязка или транзакция" },
      { status: 400 }
    )
  }

  const binding = await findPendingBinding(bindingId)

  // Привязку завершает только тот, кто её начал: иначе чужой картой
  // можно было бы подменить получателя выплат.
  if (!binding || binding.userId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "Привязка не найдена" },
      { status: 404 }
    )
  }

  const outcome = await completeCardBinding(bindingId, transactionId)

  if (outcome.result === "bound") {
    return NextResponse.json({
      success: true,
      data: { cardMask: outcome.cardMask },
    })
  }

  const errors: Record<string, string> = {
    pending: "Карта ещё проверяется, попробуйте через минуту",
    declined: "Банк отклонил проверку карты",
    not_found: "Привязка не найдена",
    payment_error: "Не удалось проверить карту",
  }

  return NextResponse.json(
    { success: false, error: errors[outcome.result] ?? "Не удалось привязать карту" },
    { status: outcome.result === "not_found" ? 404 : 400 }
  )
}
