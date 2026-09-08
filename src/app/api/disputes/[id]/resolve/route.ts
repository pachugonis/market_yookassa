import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  refundCapturedPurchase,
  releaseHold,
  settlePurchase,
} from "@/lib/purchase-fulfillment"

/**
 * Разрешение спора. Куда уйдут деньги, зависит от того, списаны они
 * уже или всё ещё заморожены:
 *
 *   холд (HELD)        отказ в споре   → списываем всю сумму (capture)
 *                      возврат         → снимаем холд, деньги на карте
 *                      частичный       → списываем часть, остаток вернётся
 *   списано (COMPLETED) возврат        → возврат через /refunds
 *   старые покупки без платежа в ЮKassa → расчёт по внутренним балансам
 */
export async function POST(
  request: Request,
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

    const { resolution, resolutionNote, refundAmount } = await request.json()

    if (!resolution) {
      return NextResponse.json(
        { success: false, error: "Не указан тип решения" },
        { status: 400 }
      )
    }

    const validResolutions = ["REFUND_BUYER", "REJECT_DISPUTE", "PARTIAL_REFUND"]
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { success: false, error: "Неверный тип решения" },
        { status: 400 }
      )
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        purchase: {
          include: {
            product: {
              select: {
                id: true,
                sellerId: true,
              },
            },
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Спор не найден" },
        { status: 404 }
      )
    }

    // Check if user is seller or admin
    const isSeller = dispute.purchase.product.sellerId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isSeller && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Только продавец или администратор может разрешить спор" },
        { status: 403 }
      )
    }

    // Check if dispute is still open
    if (dispute.status !== "OPEN") {
      return NextResponse.json(
        { success: false, error: "Спор уже закрыт" },
        { status: 400 }
      )
    }

    const purchase = dispute.purchase

    let newDisputeStatus: "RESOLVED_REFUNDED" | "RESOLVED_REJECTED" = "RESOLVED_REJECTED"
    let finalRefundAmount = 0

    // Возвращать можно только то, что ещё не вернули
    const settled = purchase.capturedAmount ?? purchase.amount
    const refundable = settled - purchase.refundedAmount

    if (resolution === "REFUND_BUYER") {
      newDisputeStatus = "RESOLVED_REFUNDED"
      finalRefundAmount = Math.max(refundable, 0)
    } else if (resolution === "PARTIAL_REFUND") {
      // Сумма приходит от клиента — принимаем только целое число
      // в пределах суммы покупки.
      if (
        typeof refundAmount !== "number" ||
        !Number.isInteger(refundAmount) ||
        refundAmount <= 0 ||
        refundAmount >= refundable
      ) {
        return NextResponse.json(
          { success: false, error: "Неверная сумма возврата" },
          { status: 400 }
        )
      }

      newDisputeStatus = "RESOLVED_REFUNDED"
      finalRefundAmount = refundAmount
    }

    // Сначала закрываем спор — условный UPDATE не даёт двум запросам
    // провести расчёт дважды. Если платёжная операция не удастся,
    // спор вернётся в OPEN.
    const claimed = await prisma.dispute.updateMany({
      where: { id, status: "OPEN" },
      data: {
        status: newDisputeStatus,
        resolution,
        resolutionNote: resolutionNote || null,
        refundAmount: finalRefundAmount > 0 ? finalRefundAmount : null,
        resolvedAt: new Date(),
      },
    })

    if (claimed.count === 0) {
      return NextResponse.json(
        { success: false, error: "Спор уже закрыт" },
        { status: 400 }
      )
    }

    const settlement = await applyResolution({
      purchaseId: purchase.id,
      purchaseStatus: purchase.status,
      purchaseAmount: purchase.amount,
      hasYooKassaPayment: Boolean(purchase.yookassaPaymentId),
      sellerId: purchase.product.sellerId,
      buyerId: purchase.buyerId,
      sellerEarnings: purchase.sellerEarnings,
      resolution,
      refundAmount: finalRefundAmount,
    })

    if (!settlement.ok) {
      // Деньги не сдвинулись — спор должен остаться открытым, иначе
      // он «решён», а расчёт не проведён.
      await prisma.dispute.updateMany({
        where: { id, status: newDisputeStatus },
        data: {
          status: "OPEN",
          resolution: null,
          resolutionNote: null,
          refundAmount: null,
          resolvedAt: null,
        },
      })

      return NextResponse.json(
        { success: false, error: settlement.error },
        { status: 502 }
      )
    }

    const updatedDispute = await prisma.dispute.findUniqueOrThrow({ where: { id } })

    // TODO: Send notifications to both parties

    return NextResponse.json({
      success: true,
      data: updatedDispute,
      message: settlement.message,
    })
  } catch (error) {
    console.error("Error resolving dispute:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при разрешении спора" },
      { status: 500 }
    )
  }
}

type SettlementResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

async function applyResolution({
  purchaseId,
  purchaseStatus,
  purchaseAmount,
  hasYooKassaPayment,
  sellerId,
  buyerId,
  sellerEarnings,
  resolution,
  refundAmount,
}: {
  purchaseId: string
  purchaseStatus: string
  purchaseAmount: number
  hasYooKassaPayment: boolean
  sellerId: string
  buyerId: string
  sellerEarnings: number
  resolution: string
  refundAmount: number
}): Promise<SettlementResult> {
  // Покупки, оплаченные до перехода на эскроу (или вручную), считаем
  // по внутренним балансам, как раньше.
  if (!hasYooKassaPayment) {
    return legacyBalanceSettlement({
      purchaseId,
      purchaseAmount,
      sellerId,
      buyerId,
      sellerEarnings,
      resolution,
      refundAmount,
    })
  }

  if (purchaseStatus === "HELD") {
    if (resolution === "REJECT_DISPUTE") {
      const outcome = await settlePurchase(purchaseId, { confirmedBy: "DISPUTE" })

      if (outcome.result === "settled" || outcome.result === "already_settled") {
        return { ok: true, message: "Спор отклонён, оплата передана продавцу" }
      }

      if (outcome.result === "hold_expired") {
        return {
          ok: true,
          message: "Спор отклонён, но срок удержания истёк — деньги вернулись покупателю",
        }
      }

      return { ok: false, error: "Не удалось провести оплату продавцу" }
    }

    if (resolution === "REFUND_BUYER") {
      const outcome = await releaseHold(purchaseId)

      if (outcome.result === "released" || outcome.result === "already_released") {
        return { ok: true, message: "Спор разрешён, деньги вернулись покупателю" }
      }

      return { ok: false, error: "Не удалось отменить удержание средств" }
    }

    // Частичный возврат: списываем только то, что остаётся продавцу,
    // остальное ЮKassa вернёт покупателю сама.
    const outcome = await settlePurchase(purchaseId, {
      amount: purchaseAmount - refundAmount,
      confirmedBy: "DISPUTE",
    })

    if (outcome.result === "settled") {
      return { ok: true, message: "Спор разрешён, часть суммы возвращена покупателю" }
    }

    if (outcome.result === "already_settled") {
      return { ok: true, message: "Сделка уже была подтверждена" }
    }

    return { ok: false, error: "Не удалось провести частичный возврат" }
  }

  if (purchaseStatus === "COMPLETED") {
    if (resolution === "REJECT_DISPUTE") {
      return { ok: true, message: "Спор отклонён" }
    }

    if (refundAmount <= 0) {
      return { ok: true, message: "Возврат по этой покупке уже оформлен" }
    }

    const outcome = await refundCapturedPurchase(purchaseId, refundAmount)

    if (outcome.result === "refunded") {
      return { ok: true, message: "Спор разрешён, возврат отправлен покупателю" }
    }

    if (outcome.result === "invalid_amount") {
      return { ok: false, error: "Сумма возврата превышает доступную к возврату" }
    }

    return { ok: false, error: "Не удалось оформить возврат в ЮKassa" }
  }

  if (resolution === "REJECT_DISPUTE") {
    return { ok: true, message: "Спор отклонён" }
  }

  return { ok: false, error: "Возврат по этой покупке невозможен" }
}

/**
 * Расчёт по внутренним балансам — для покупок без платежа в ЮKassa.
 * Списание с продавца всегда пропорционально возврату: иначе покупателю
 * начислялись бы деньги, которые никто не терял.
 */
async function legacyBalanceSettlement({
  purchaseId,
  purchaseAmount,
  sellerId,
  buyerId,
  sellerEarnings,
  resolution,
  refundAmount,
}: {
  purchaseId: string
  purchaseAmount: number
  sellerId: string
  buyerId: string
  sellerEarnings: number
  resolution: string
  refundAmount: number
}): Promise<SettlementResult> {
  if (resolution === "REJECT_DISPUTE" || refundAmount <= 0) {
    return { ok: true, message: "Спор отклонён" }
  }

  const refundRatio = refundAmount / purchaseAmount
  const sellerDeduction = Math.floor(sellerEarnings * refundRatio)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: buyerId },
      data: { balance: { increment: refundAmount } },
    })

    if (sellerDeduction > 0) {
      await tx.user.update({
        where: { id: sellerId },
        data: { balance: { decrement: sellerDeduction } },
      })
    }

    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        refundedAmount: refundAmount,
        ...(refundAmount >= purchaseAmount ? { status: "REFUNDED" as const } : {}),
      },
    })
  })

  return { ok: true, message: "Спор разрешён, средства зачислены на баланс покупателя" }
}
