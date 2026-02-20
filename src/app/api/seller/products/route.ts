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

    if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const products = await prisma.product.findMany({
      where: { sellerId: session.user.id },
      include: {
        category: { select: { name: true } },
        _count: { select: { purchases: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    console.error("Error fetching seller products:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении товаров" },
      { status: 500 }
    )
  }
}
