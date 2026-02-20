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

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      availableBalance,
      totalProducts,
      totalSales,
      recentSales,
    ] = await Promise.all([
      // Available balance - only purchases older than 24 hours AND no active disputes
      prisma.purchase.aggregate({
        where: {
          product: { sellerId: session.user.id },
          status: "COMPLETED",
          createdAt: { lt: twentyFourHoursAgo },
          OR: [
            { dispute: null },
            { dispute: { status: { not: "OPEN" } } },
          ],
        },
        _sum: { sellerEarnings: true },
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
        balance: availableBalance._sum.sellerEarnings || 0,
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
