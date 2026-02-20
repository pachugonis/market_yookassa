import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const { productId, rating, comment } = await request.json()

    if (!productId || !rating) {
      return NextResponse.json(
        { success: false, error: "Необходимо указать товар и рейтинг" },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "Рейтинг должен быть от 1 до 5" },
        { status: 400 }
      )
    }

    // Check if user has purchased this product
    const purchase = await prisma.purchase.findFirst({
      where: {
        buyerId: session.user.id,
        productId,
        status: "COMPLETED",
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: "Вы можете оставить отзыв только на купленный товар" },
        { status: 403 }
      )
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: {
        buyerId_productId: {
          buyerId: session.user.id,
          productId,
        },
      },
    })

    if (existingReview) {
      // Update existing review
      const updatedReview = await prisma.review.update({
        where: { id: existingReview.id },
        data: {
          rating,
          comment: comment || null,
        },
        include: {
          buyer: { select: { name: true, avatar: true } },
        },
      })

      return NextResponse.json({
        success: true,
        data: updatedReview,
        message: "Отзыв обновлен",
      })
    }

    // Create new review
    const review = await prisma.review.create({
      data: {
        buyerId: session.user.id,
        productId,
        rating,
        comment: comment || null,
      },
      include: {
        buyer: { select: { name: true, avatar: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: review,
      message: "Отзыв добавлен",
    })
  } catch (error) {
    console.error("Error creating review:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при создании отзыва" },
      { status: 500 }
    )
  }
}
