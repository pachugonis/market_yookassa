import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isValidBitcoinAddress } from "@/lib/btcpay"
import {
  cancelWithdrawal,
  completeManualRefund,
  syncPayoutWithProvider,
} from "@/lib/payments/btc-payouts"

/**
 * Действия администратора над заявкой:
 *
 *   refresh  — перечитать состояние выплаты в BTCPay;
 *   cancel   — отклонить заявку продавца, вернув сатоши на его баланс;
 *   complete — закрыть ручной возврат покупателю после отправки денег.
 *
 * Одобрение и подпись транзакции здесь недоступны намеренно: ключи
 * кошелька приложению не принадлежат, это делается в BTCPay.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Доступ запрещен" },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const action = body?.action

  if (action === "refresh") {
    const outcome = await syncPayoutWithProvider(id)

    if (!outcome) {
      return NextResponse.json(
        { success: false, error: "Заявка не найдена" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: outcome })
  }

  if (action === "cancel") {
    const note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim().slice(0, 500)
        : "Заявка отклонена администратором"

    const outcome = await cancelWithdrawal(id, note)

    if (outcome.result === "not_found") {
      return NextResponse.json(
        { success: false, error: "Заявка не найдена" },
        { status: 404 }
      )
    }

    if (outcome.result === "not_pending") {
      return NextResponse.json(
        { success: false, error: "Заявка уже закрыта" },
        { status: 400 }
      )
    }

    if (outcome.result === "provider_error") {
      return NextResponse.json(
        {
          success: false,
          error: "BTCPay не отменил выплату — возможно, она уже отправлена",
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  }

  if (action === "complete") {
    const destination =
      typeof body.destination === "string" ? body.destination.trim() : ""

    if (destination && !isValidBitcoinAddress(destination)) {
      return NextResponse.json(
        { success: false, error: "Это не похоже на биткоин-адрес" },
        { status: 400 }
      )
    }

    const txId =
      typeof body.txId === "string" && /^[0-9a-fA-F]{64}$/.test(body.txId.trim())
        ? body.txId.trim()
        : undefined

    const outcome = await completeManualRefund(id, { txId, destination })

    if (outcome.result === "not_found") {
      return NextResponse.json(
        { success: false, error: "Возврат не найден" },
        { status: 404 }
      )
    }

    if (outcome.result === "not_pending") {
      return NextResponse.json(
        { success: false, error: "Возврат уже закрыт" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { success: false, error: "Неизвестное действие" },
    { status: 400 }
  )
}
