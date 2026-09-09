import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isBTCPayConfigured, serverUrl, storeId } from "@/lib/btcpay"
import type { Prisma } from "@prisma/client"

/**
 * Журнал исходящих операций для администратора: заявки продавцов на
 * вывод и ручные возвраты покупателям.
 *
 * Подписывает транзакции администратор в BTCPay — сюда он приходит
 * увидеть, что именно ждёт подписи и по какой сделке.
 */

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Доступ запрещен" },
      { status: 403 }
    )
  }

  const status = request.nextUrl.searchParams.get("status")
  const kind = request.nextUrl.searchParams.get("kind")

  const where: Prisma.PayoutWhereInput = {}

  if (status && ["PENDING", "PROCESSING", "COMPLETED", "FAILED"].includes(status)) {
    where.status = status as Prisma.PayoutWhereInput["status"]
  }

  if (kind && ["SELLER_WITHDRAWAL", "BUYER_REFUND"].includes(kind)) {
    where.kind = kind as Prisma.PayoutWhereInput["kind"]
  }

  const payouts = await prisma.payout.findMany({
    where,
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: PAGE_SIZE,
    include: {
      recipient: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      payouts,
      // Ссылка в кабинет BTCPay: одобрение и подпись живут там.
      btcpayUrl: isBTCPayConfigured()
        ? `${serverUrl()}/stores/${storeId()}/payouts`
        : null,
    },
  })
}
