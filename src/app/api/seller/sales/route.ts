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

    const sales = await prisma.purchase.findMany({
      where: {
        product: { sellerId: session.user.id },
        status: "COMPLETED",
      },
      include: {
        product: { select: { id: true, title: true, coverImage: true } },
        buyer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: sales })
  } catch (error) {
    console.error("Error fetching sales:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении продаж" },
      { status: 500 }
    )
  }
}
