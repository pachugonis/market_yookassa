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

    // Close the dispute and add funds to seller's balance
    const [updatedDispute] = await prisma.$transaction([
      prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: "CLOSED",
          resolvedAt: new Date(),
        },
      }),
      // Add seller earnings to seller's balance
      prisma.user.update({
        where: { id: dispute.purchase.product.sellerId },
        data: {
          balance: {
            increment: dispute.purchase.sellerEarnings,
          },
        },
      }),
    ])

    console.log("[POST /api/disputes/[id]/close] Dispute closed by buyer")
    console.log("[POST /api/disputes/[id]/close] Added to seller balance:", dispute.purchase.sellerEarnings)

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
