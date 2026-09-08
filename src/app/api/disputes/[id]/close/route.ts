import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST - Close a dispute (buyer only)
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    // Handle both Promise and direct params for Next.js compatibility
    const params = context.params instanceof Promise ? await context.params : context.params
    const disputeId = params.id

    console.log("[POST /api/disputes/[id]/close] Dispute ID:", disputeId)
    console.log("[POST /api/disputes/[id]/close] User ID:", session.user.id)

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        purchase: {
          select: {
            id: true,
            sellerEarnings: true,
            product: {
              select: {
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

    // Only buyer can close the dispute
    if (dispute.buyerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Только покупатель может закрыть спор" },
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

    // Деньги здесь не двигаем. Если сделка ещё в холде, покупатель
    // подтвердит её сам либо это сделает автоподтверждение (см.
    // /api/cron/settle-holds); если уже подтверждена — выручка давно
    // у продавца, и закрытие спора просто снимает удержание.
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId, status: "OPEN" },
      data: {
        status: "CLOSED",
        resolvedAt: new Date(),
      },
    })

    console.log("[POST /api/disputes/[id]/close] Dispute closed by buyer")

    return NextResponse.json({
      success: true,
      data: updatedDispute,
      message: "Спор закрыт",
    })
  } catch (error) {
    console.error("[POST /api/disputes/[id]/close] Error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при закрытии спора" },
      { status: 500 }
    )
  }
}
