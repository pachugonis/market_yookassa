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

    const [
      user,
      totalProducts,
      totalSales,
      recentSales,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { balance: true },
      }),
      prisma.product.count({
        where: { sellerId: session.user.id },
      }),
      prisma.purchase.aggregate({
        where: {
          product: { sellerId: session.user.id },
          status: "COMPLETED",
        },
        _sum: { sellerEarnings: true },
        _count: true,
      }),
      prisma.purchase.findMany({
        where: {
          product: { sellerId: session.user.id },
          status: "COMPLETED",
        },
        include: {
          product: { select: { title: true } },
          buyer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        balance: user?.balance || 0,
        totalProducts,
        totalSales: totalSales._count,
        totalEarnings: totalSales._sum.sellerEarnings || 0,
        recentSales,
      },
    })
  } catch (error) {
    console.error("Error fetching seller stats:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении статистики" },
      { status: 500 }
    )
  }
}
