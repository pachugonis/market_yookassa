import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isBTCPayConfigured } from "@/lib/payments/config"
import { quoteWithdrawal, requestWithdrawal } from "@/lib/payments/btc-payouts"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Вывод биткоина продавцом.
 *
 * GET  — баланс, котировка комиссии сети и история заявок.
 * POST — заявка на вывод: сумма списывается с баланса сразу, а
 *        транзакцию подписывает администратор в BTCPay.
 *
 * Комиссия за вывод считается по оценке сети в момент запроса и
 * показывается продавцу до подтверждения: заявка создаётся уже с
 * посчитанной суммой к получению.
 */

export const dynamic = "force-dynamic"

const PAYOUT_HISTORY_LIMIT = 20

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 }
    )
  }

  if (!isBTCPayConfigured()) {
    return NextResponse.json(
      { success: false, error: "Оплата биткоином не подключена на площадке" },
      { status: 503 }
    )
  }

  const [seller, payouts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balanceSats: true, btcPayoutAddress: true },
    }),
    prisma.payout.findMany({
      where: {
        recipientId: session.user.id,
        asset: "BTC",
        kind: "SELLER_WITHDRAWAL",
      },
      orderBy: { requestedAt: "desc" },
      take: PAYOUT_HISTORY_LIMIT,
      select: {
        id: true,
        status: true,
        amountSats: true,
        feeSats: true,
        netSats: true,
        destination: true,
        txId: true,
        note: true,
        requestedAt: true,
        processedAt: true,
      },
    }),
  ])

  if (!seller) {
    return NextResponse.json(
      { success: false, error: "Профиль не найден" },
      { status: 404 }
    )
  }

  // Котировка требует живой оценки сети. Если она недоступна, баланс
  // и историю всё равно показываем — просто без кнопки вывода.
  let quote = null
  let quoteError: string | null = null

  try {
    quote = await quoteWithdrawal(seller.balanceSats)
  } catch (error) {
    console.error("Не удалось оценить комиссию сети:", error)
    quoteError = "Оценка комиссии сети временно недоступна"
  }

  return NextResponse.json({
    success: true,
    data: {
      balanceSats: seller.balanceSats,
      address: seller.btcPayoutAddress,
      quote,
      quoteError,
      payouts,
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 }
    )
  }

  if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Вывод доступен только продавцам" },
      { status: 403 }
    )
  }

  // Каждая заявка — работа для администратора, поэтому подавать их
  // пачками незачем.
  const limit = rateLimit(`btc-payout:${session.user.id}`, 5, 60 * 60 * 1000)

  if (!limit.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Слишком много заявок. Повторите через ${limit.retryAfterSeconds} с`,
      },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => ({}))

  // Сумма приходит в сатоши; «весь баланс» считается на сервере, чтобы
  // клиент не гадал, сколько там сейчас.
  let amountSats: number

  if (body?.all === true) {
    const seller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balanceSats: true },
    })

    amountSats = seller?.balanceSats ?? 0
  } else if (Number.isInteger(body?.amountSats)) {
    amountSats = body.amountSats
  } else {
    return NextResponse.json(
      { success: false, error: "Сумма вывода указана неверно" },
      { status: 400 }
    )
  }

  const outcome = await requestWithdrawal({
    sellerId: session.user.id,
    amountSats,
  })

  switch (outcome.result) {
    case "created":
      return NextResponse.json({ success: true, data: outcome.payout })

    case "not_configured":
      return NextResponse.json(
        { success: false, error: "Вывод биткоина не подключён на площадке" },
        { status: 503 }
      )

    case "no_address":
      return NextResponse.json(
        {
          success: false,
          error: "Укажите биткоин-адрес для вывода в разделе «Доходы»",
        },
        { status: 400 }
      )

    case "invalid_amount":
      return NextResponse.json(
        { success: false, error: "Сумма вывода указана неверно" },
        { status: 400 }
      )

    case "below_minimum":
      return NextResponse.json(
        {
          success: false,
          error: `Минимальная сумма к получению — ${outcome.minPayoutSats} сатоши, комиссия сети сейчас ${outcome.feeSats} сатоши`,
        },
        { status: 400 }
      )

    case "insufficient_funds":
      return NextResponse.json(
        { success: false, error: "Недостаточно средств на балансе" },
        { status: 400 }
      )

    case "fee_unavailable":
      return NextResponse.json(
        {
          success: false,
          error:
            "Оценка комиссии сети недоступна — попробуйте позже, чтобы не переплатить",
        },
        { status: 503 }
      )

    case "provider_error":
      return NextResponse.json(
        { success: false, error: outcome.message },
        { status: 502 }
      )
  }
}
