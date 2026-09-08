import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { settlePurchase } from "@/lib/purchase-fulfillment"
import { getClientIp, rateLimit } from "@/lib/rate-limit"

/**
 * Шаг 3 сделки: покупатель подтверждает приём товара.
 *
 * Только после этого замороженные средства списываются и уходят
 * продавцу — до подтверждения деньги висят на карте покупателя и
 * не принадлежат никому.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    // Подтверждение ходит в платёжный API, поэтому ограничиваем частоту
    const limit = rateLimit(`confirm:${getClientIp(request)}`, 20, 60_000)

    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: "Слишком много запросов, попробуйте позже" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      )
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      select: {
        id: true,
        buyerId: true,
        status: true,
        dispute: { select: { id: true, status: true } },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: "Покупка не найдена" },
        { status: 404 }
      )
    }

    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Нет доступа к этой покупке" },
        { status: 403 }
      )
    }

    if (purchase.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        data: { status: "COMPLETED" },
        message: "Сделка уже подтверждена",
      })
    }

    if (purchase.status !== "HELD") {
      return NextResponse.json(
        { success: false, error: "Сделку в этом статусе нельзя подтвердить" },
        { status: 400 }
      )
    }

    // Пока идёт спор, деньги не должны уходить продавцу: исход спора
    // может потребовать вернуть их покупателю.
    if (purchase.dispute && purchase.dispute.status === "OPEN") {
      return NextResponse.json(
        {
          success: false,
          error: "По покупке открыт спор — сначала нужно его закрыть",
        },
        { status: 400 }
      )
    }

    const outcome = await settlePurchase(purchase.id, { confirmedBy: "BUYER" })

    switch (outcome.result) {
      case "settled":
        return NextResponse.json({
          success: true,
          data: { status: "COMPLETED", capturedAmount: outcome.capturedAmount },
          message: "Спасибо! Оплата передана продавцу",
        })

      case "already_settled":
        return NextResponse.json({
          success: true,
          data: { status: "COMPLETED" },
          message: "Сделка уже подтверждена",
        })

      case "locked":
        return NextResponse.json(
          { success: false, error: "Подтверждение уже выполняется" },
          { status: 409 }
        )

      case "hold_expired":
        return NextResponse.json(
          {
            success: false,
            error: "Срок удержания средств истёк, деньги вернулись покупателю",
          },
          { status: 409 }
        )

      case "not_found":
      case "not_held":
        return NextResponse.json(
          { success: false, error: "Сделку в этом статусе нельзя подтвердить" },
          { status: 400 }
        )

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Не удалось подтвердить оплату. Попробуйте позже",
          },
          { status: 502 }
        )
    }
  } catch (error) {
    console.error("Error confirming purchase:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при подтверждении сделки" },
      { status: 500 }
    )
  }
}
