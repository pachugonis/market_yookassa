import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET - List buyer's disputes
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const disputes = await prisma.dispute.findMany({
      where: { buyerId: session.user.id },
      include: {
        purchase: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                coverImage: true,
                seller: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: disputes })
  } catch (error) {
    console.error("Error fetching disputes:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке споров" },
      { status: 500 }
    )
  }
}

// POST - Create a new dispute
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const { purchaseId, reason } = await request.json()

    if (!purchaseId || !reason) {
      return NextResponse.json(
        { success: false, error: "Не указаны обязательные поля" },
        { status: 400 }
      )
    }

    // Verify purchase belongs to user
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        product: {
          select: {
            sellerId: true,
          },
        },
        dispute: true,
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
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    // Check if purchase is completed
    if (purchase.status !== "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Спор можно открыть только для завершенных покупок" },
        { status: 400 }
      )
    }

    // Check if dispute already exists
    if (purchase.dispute) {
      return NextResponse.json(
        { success: false, error: "Спор уже открыт для этой покупки" },
        { status: 400 }
      )
    }

    // Check if 24 hours have passed
    const hoursSincePurchase = (Date.now() - purchase.createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursSincePurchase > 24) {
      return NextResponse.json(
        { success: false, error: "Спор можно открыть только в течение 24 часов после покупки" },
        { status: 400 }
      )
    }

    // Check if review exists (if review exists, deal is closed)
    const review = await prisma.review.findUnique({
      where: {
        buyerId_productId: {
          buyerId: session.user.id,
          productId: purchase.productId,
        },
      },
    })

    if (review) {
      return NextResponse.json(
        { success: false, error: "Спор невозможен, так как уже оставлен отзыв. Сделка считается закрытой." },
        { status: 400 }
      )
    }

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        purchaseId,
        buyerId: session.user.id,
        reason,
      },
      include: {
        purchase: {
          include: {
            product: {
              select: {
                title: true,
                seller: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // TODO: Send notification to seller
    console.log(`Dispute opened for purchase ${purchaseId} by buyer ${session.user.id}`)

    return NextResponse.json({
      success: true,
      data: dispute,
      message: "Спор открыт. Продавец уведомлен.",
    })
  } catch (error) {
    console.error("Error creating dispute:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при создании спора" },
      { status: 500 }
    )
  }
}
