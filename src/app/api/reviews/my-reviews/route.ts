import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const reviews = await prisma.review.findMany({
      where: { buyerId: session.user.id },
      select: {
        id: true,
        productId: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: reviews })
  } catch (error) {
    console.error("Error fetching user reviews:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении отзывов" },
      { status: 500 }
    )
  }
}
