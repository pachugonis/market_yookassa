import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { getGateway } from "@/lib/payments"
import {
  releaseHold,
  settlePurchase,
  syncPurchaseWithPayment,
} from "@/lib/purchase-fulfillment"

/**
 * Фоновая обработка холдов. Запускается по расписанию (раз в 10–15 минут):
 *
 *   curl -X POST https://<host>/api/cron/settle-holds \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Три задачи, каждая из которых иначе оставила бы деньги подвешенными:
 *   1) подтвердить сделки, которые покупатель не подтвердил сам;
 *   2) снять холд по спорам, не решённым до конца срока удержания;
 *   3) закрыть покупки, чей холд провайдер уже снял сам.
 */

export const dynamic = "force-dynamic"

/** Сколько сделок обрабатываем за один запуск. */
const BATCH_SIZE = 50

/** Ближе этого срока к концу холда подтверждать уже рискованно. */
const HOLD_DEADLINE_MS = 6 * 60 * 60 * 1000

/** Неоплаченные заказы старше этого срока сверяем с провайдером и закрываем. */
const ABANDONED_PENDING_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = new Date()
  const holdDeadline = new Date(now.getTime() + HOLD_DEADLINE_MS)

  const stats = {
    autoConfirmed: 0,
    released: 0,
    expired: 0,
    abandoned: 0,
    failed: 0,
  }

  // 1. Пора подтверждать: покупатель промолчал, спор не открыт.
  const dueForCapture = await prisma.purchase.findMany({
    where: {
      status: "HELD",
      autoConfirmAt: { lte: now },
      OR: [{ dispute: null }, { dispute: { status: { not: "OPEN" } } }],
    },
    select: { id: true },
    orderBy: { autoConfirmAt: "asc" },
    take: BATCH_SIZE,
  })

  for (const purchase of dueForCapture) {
    const outcome = await settlePurchase(purchase.id, { confirmedBy: "AUTO" })

    if (outcome.result === "settled" || outcome.result === "already_settled") {
      stats.autoConfirmed += 1
    } else if (outcome.result === "hold_expired") {
      stats.expired += 1
    } else if (outcome.result !== "locked") {
      stats.failed += 1
      console.error(`Auto-capture failed for ${purchase.id}:`, outcome.result)
    }
  }

  // 2. Спор не успели решить до конца холда. Деньги возвращаем
  // покупателю: списать их после expires_at всё равно не выйдет.
  const expiringDisputes = await prisma.purchase.findMany({
    where: {
      status: "HELD",
      holdExpiresAt: { lte: holdDeadline },
      dispute: { status: "OPEN" },
    },
    select: { id: true },
    take: BATCH_SIZE,
  })

  for (const purchase of expiringDisputes) {
    const outcome = await releaseHold(purchase.id)

    if (outcome.result === "released" || outcome.result === "already_released") {
      stats.released += 1
    } else {
      stats.failed += 1
      console.error(`Hold release failed for ${purchase.id}:`, outcome.result)
    }
  }

  // 3. Холд уже должен был истечь — сверяем состояние с провайдером.
  const staleHolds = await prisma.purchase.findMany({
    where: { status: "HELD", holdExpiresAt: { lt: now } },
    select: { id: true, paymentProvider: true, providerPaymentId: true },
    take: BATCH_SIZE,
  })

  for (const purchase of staleHolds) {
    if (!purchase.providerPaymentId) continue

    try {
      const payment = await getGateway(purchase.paymentProvider).getPayment(
        purchase.providerPaymentId
      )
      const outcome = await syncPurchaseWithPayment(purchase.id, payment)

      if (outcome.result === "released") stats.expired += 1
      if (outcome.result === "settled") stats.autoConfirmed += 1
    } catch (error) {
      stats.failed += 1
      console.error(`Hold sync failed for ${purchase.id}:`, error)
    }
  }

  // 4. Заказы, которые так и не оплатили.
  const abandoned = await prisma.purchase.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(now.getTime() - ABANDONED_PENDING_MS) },
    },
    select: { id: true, paymentProvider: true, providerPaymentId: true },
    take: BATCH_SIZE,
  })

  for (const purchase of abandoned) {
    try {
      const gateway = getGateway(purchase.paymentProvider)

      // Транзакция могла и не появиться: у CloudPayments она создаётся
      // только когда покупатель начал оплату в виджете.
      const payment = purchase.providerPaymentId
        ? await gateway.getPayment(purchase.providerPaymentId)
        : await gateway.findPaymentByPurchase(purchase.id)

      if (!payment) {
        await prisma.purchase.updateMany({
          where: { id: purchase.id, status: "PENDING" },
          data: { status: "FAILED" },
        })
        stats.abandoned += 1
        continue
      }

      const outcome = await syncPurchaseWithPayment(purchase.id, payment)

      // Заодно спасаем заказы, по которым потерялось уведомление:
      // платёж мог уже перейти в состояние заморозки.
      if (outcome.result === "failed") stats.abandoned += 1
    } catch (error) {
      stats.failed += 1
      console.error(`Pending sync failed for ${purchase.id}:`, error)
    }
  }

  console.log("Hold settlement run:", stats)

  return NextResponse.json({ success: true, data: stats })
}

/**
 * Эндпоинт двигает реальные деньги, поэтому доступен только по секрету
 * из окружения. Сравнение — за постоянное время.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error("CRON_SECRET не задан — эндпоинт отключён")
    return false
  }

  const header = request.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header

  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(secret, "utf8")

  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
