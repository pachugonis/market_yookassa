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
      heldSales,
      cryptoBalance,
      cryptoEarned,
      cryptoHeld,
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
      // Деньги, замороженные на картах покупателей: сделка оплачена,
      // но приём товара ещё не подтверждён.
      prisma.purchase.aggregate({
        where: {
          product: { sellerId: session.user.id },
          status: "HELD",
        },
        _sum: { sellerEarnings: true },
        _count: true,
      }),
      // Биткоин живёт отдельным балансом в сатоши: он списывается
      // заявками на вывод, поэтому берётся из счёта продавца, а не
      // складывается из сделок.
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { balanceSats: true, btcPayoutAddress: true },
      }),
      prisma.purchase.aggregate({
        where: {
          product: { sellerId: session.user.id },
          status: "COMPLETED",
          paymentProvider: "BTCPAY",
        },
        _sum: { cryptoSellerSats: true, cryptoCommissionSats: true },
        _count: true,
      }),
      // Сатоши по сделкам, которые покупатель ещё не подтвердил.
      prisma.purchase.findMany({
        where: {
          product: { sellerId: session.user.id },
          status: "HELD",
          paymentProvider: "BTCPAY",
        },
        select: {
          amount: true,
          sellerEarnings: true,
          cryptoAmountSats: true,
        },
      }),
    ])

    // Доля продавца в сатоши считается той же пропорцией, что и в
    // рублях: курс на момент оплаты уже зафиксирован в сделке.
    const heldSats = cryptoHeld.reduce((sum, purchase) => {
      if (!purchase.cryptoAmountSats || purchase.amount <= 0) return sum
      return (
        sum +
        Math.round(
          (purchase.cryptoAmountSats * purchase.sellerEarnings) / purchase.amount
        )
      )
    }, 0)

    return NextResponse.json({
      success: true,
      data: {
        balance: availableBalance._sum.sellerEarnings || 0,
        totalProducts,
        totalSales: totalSales._count,
        totalEarnings: totalSales._sum.sellerEarnings || 0,
        recentSales,
        heldEarnings: heldSales._sum.sellerEarnings || 0,
        heldCount: heldSales._count,
        balanceSats: cryptoBalance?.balanceSats ?? 0,
        btcPayoutAddress: cryptoBalance?.btcPayoutAddress ?? null,
        earnedSats: cryptoEarned._sum.cryptoSellerSats || 0,
        commissionSats: cryptoEarned._sum.cryptoCommissionSats || 0,
        cryptoSales: cryptoEarned._count,
        heldSats,
        heldSatsCount: cryptoHeld.length,
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
