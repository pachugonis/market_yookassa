import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST - Resolve a dispute (seller or admin only)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
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
      where: { id: params.id },
      include: {
        purchase: {
          include: {
            product: {
              select: {
                id: true,
                sellerId: true,
                seller: {
                  select: {
                    id: true,
                    balance: true,
                  },
                },
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            balance: true,
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

    let newDisputeStatus: "RESOLVED_REFUNDED" | "RESOLVED_REJECTED" = "RESOLVED_REJECTED"
    let finalRefundAmount = 0

    // Process based on resolution type
    if (resolution === "REFUND_BUYER") {
      newDisputeStatus = "RESOLVED_REFUNDED"
      finalRefundAmount = dispute.purchase.amount

      // Refund buyer
      await prisma.user.update({
        where: { id: dispute.buyerId },
        data: {
          balance: {
            increment: finalRefundAmount,
          },
        },
      })

      // Deduct from seller's balance (if sufficient)
      const sellerEarnings = dispute.purchase.sellerEarnings
      if (dispute.purchase.product.seller.balance >= sellerEarnings) {
        await prisma.user.update({
          where: { id: dispute.purchase.product.sellerId },
          data: {
            balance: {
              decrement: sellerEarnings,
            },
          },
        })
      }

      // Update purchase status
      await prisma.purchase.update({
        where: { id: dispute.purchaseId },
        data: {
          status: "REFUNDED",
        },
      })
    } else if (resolution === "PARTIAL_REFUND") {
      if (!refundAmount || refundAmount <= 0 || refundAmount > dispute.purchase.amount) {
        return NextResponse.json(
          { success: false, error: "Неверная сумма возврата" },
          { status: 400 }
        )
      }

      newDisputeStatus = "RESOLVED_REFUNDED"
      finalRefundAmount = refundAmount

      // Partial refund to buyer
      await prisma.user.update({
        where: { id: dispute.buyerId },
        data: {
          balance: {
            increment: finalRefundAmount,
          },
        },
      })

      // Deduct proportional amount from seller
      const refundRatio = finalRefundAmount / dispute.purchase.amount
      const sellerDeduction = Math.floor(dispute.purchase.sellerEarnings * refundRatio)

      if (dispute.purchase.product.seller.balance >= sellerDeduction) {
        await prisma.user.update({
          where: { id: dispute.purchase.product.sellerId },
          data: {
            balance: {
              decrement: sellerDeduction,
            },
          },
        })
      }
    }
    // For REJECT_DISPUTE, no refund or balance changes needed

    // Update dispute
    const updatedDispute = await prisma.dispute.update({
      where: { id: params.id },
      data: {
        status: newDisputeStatus,
        resolution,
        resolutionNote: resolutionNote || null,
        refundAmount: finalRefundAmount > 0 ? finalRefundAmount : null,
        resolvedAt: new Date(),
      },
    })

    // TODO: Send notifications to both parties

    return NextResponse.json({
      success: true,
      data: updatedDispute,
      message: "Спор разрешен",
    })
  } catch (error) {
    console.error("Error resolving dispute:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при разрешении спора" },
      { status: 500 }
    )
  }
}
