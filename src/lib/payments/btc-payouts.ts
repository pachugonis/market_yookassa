import { Prisma, type Payout } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  BTCPayError,
  cancelPayout,
  createPayout,
  getFeeRate,
  getPayout,
  isBTCPayConfigured,
  isValidBitcoinAddress,
  type BTCPayPayoutState,
} from "@/lib/btcpay"

/**
 * Вывод биткоина продавцу и ручные возвраты покупателям.
 *
 * Сплитования у BTCPay нет: вся оплата приходит в кошелёк площадки, а
 * доля продавца лежит на внутреннем балансе в сатоши. Отсюда она уходит
 * заявкой на выплату.
 *
 * Ключи кошелька приложению не принадлежат. Заявка создаётся в BTCPay
 * неодобренной (`approved: false`): администратор проверяет её и
 * подписывает транзакцию сам, а мы узнаём результат из уведомления.
 *
 * Комиссия за вывод удерживается из суммы заявки. Точный размер
 * транзакции известен только при подписи, поэтому берётся оценка
 * «ставка сети × расчётный размер», зажатая между минимумом и
 * максимумом из настроек: всплеск в мемпуле не сделает вывод
 * разорительным, а провал ставки не оставит площадку в убытке.
 */

export interface BtcPayoutSettings {
  minPayoutSats: number
  feeMinSats: number
  feeMaxSats: number
  feeBlockTarget: number
  txVsize: number
  quoteMinutes: number
}

const DEFAULTS: BtcPayoutSettings = {
  minPayoutSats: 50_000,
  feeMinSats: 500,
  feeMaxSats: 30_000,
  feeBlockTarget: 6,
  txVsize: 200,
  quoteMinutes: 15,
}

export async function btcPayoutSettings(): Promise<BtcPayoutSettings> {
  const settings = await prisma.platformSettings.findFirst({
    select: {
      btcMinPayoutSats: true,
      btcPayoutFeeMinSats: true,
      btcPayoutFeeMaxSats: true,
      btcPayoutFeeBlockTarget: true,
      btcPayoutTxVsize: true,
      btcPayoutQuoteMinutes: true,
    },
  })

  if (!settings) return DEFAULTS

  return {
    minPayoutSats: positive(settings.btcMinPayoutSats, DEFAULTS.minPayoutSats),
    feeMinSats: positive(settings.btcPayoutFeeMinSats, DEFAULTS.feeMinSats),
    feeMaxSats: positive(settings.btcPayoutFeeMaxSats, DEFAULTS.feeMaxSats),
    feeBlockTarget: positive(
      settings.btcPayoutFeeBlockTarget,
      DEFAULTS.feeBlockTarget
    ),
    txVsize: positive(settings.btcPayoutTxVsize, DEFAULTS.txVsize),
    quoteMinutes: positive(
      settings.btcPayoutQuoteMinutes,
      DEFAULTS.quoteMinutes
    ),
  }
}

function positive(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0
    ? (value as number)
    : fallback
}

export interface WithdrawalQuote {
  /** Доступно к выводу, сатоши. */
  balanceSats: number
  /** Удерживаемая комиссия за вывод, сатоши. */
  feeSats: number
  /** Ставка сети, по которой она посчитана, сат/vB. */
  feeRate: number
  /** Минимальная сумма к получению, сатоши. */
  minPayoutSats: number
  /** Сколько минут действует котировка. */
  quoteMinutes: number
  /** Сколько получит продавец, если выведет весь баланс. */
  maxNetSats: number
}

/**
 * Котировка вывода: сколько сейчас стоит транзакция и что останется
 * получателю. Если сеть недоступна для оценки, вывод не открывается —
 * заявка с выдуманной комиссией либо застрянет, либо съест лишнее.
 */
export async function quoteWithdrawal(
  balanceSats: number
): Promise<WithdrawalQuote> {
  const settings = await btcPayoutSettings()
  const feeRate = await getFeeRate(settings.feeBlockTarget)

  const estimated = Math.ceil(feeRate * settings.txVsize)
  const feeSats = Math.min(
    Math.max(estimated, settings.feeMinSats),
    settings.feeMaxSats
  )

  return {
    balanceSats,
    feeSats,
    feeRate,
    minPayoutSats: settings.minPayoutSats,
    quoteMinutes: settings.quoteMinutes,
    maxNetSats: Math.max(balanceSats - feeSats, 0),
  }
}

export type WithdrawalOutcome =
  | { result: "created"; payout: Payout }
  | { result: "not_configured" }
  | { result: "no_address" }
  | { result: "invalid_amount" }
  | { result: "below_minimum"; minPayoutSats: number; feeSats: number }
  | { result: "insufficient_funds" }
  | { result: "fee_unavailable" }
  | { result: "provider_error"; message: string }

/**
 * Заявка на вывод. Сумма списывается с баланса сразу — иначе один и тот
 * же остаток можно заявить дважды, пока первая выплата ждёт подписи.
 * Если BTCPay заявку не принял, списание возвращается.
 */
export async function requestWithdrawal({
  sellerId,
  amountSats,
}: {
  sellerId: string
  /** Сколько списать с баланса, включая комиссию за вывод. */
  amountSats: number
}): Promise<WithdrawalOutcome> {
  if (!isBTCPayConfigured()) return { result: "not_configured" }

  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    return { result: "invalid_amount" }
  }

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { btcPayoutAddress: true, balanceSats: true },
  })

  if (!seller) return { result: "invalid_amount" }

  const destination = seller.btcPayoutAddress?.trim()

  if (!destination || !isValidBitcoinAddress(destination)) {
    return { result: "no_address" }
  }

  if (amountSats > seller.balanceSats) return { result: "insufficient_funds" }

  let quote: WithdrawalQuote

  try {
    quote = await quoteWithdrawal(seller.balanceSats)
  } catch (error) {
    console.error("Не удалось оценить комиссию сети:", error)
    return { result: "fee_unavailable" }
  }

  const netSats = amountSats - quote.feeSats

  if (netSats < quote.minPayoutSats) {
    return {
      result: "below_minimum",
      minPayoutSats: quote.minPayoutSats,
      feeSats: quote.feeSats,
    }
  }

  // Списание и заявка — одной транзакцией: условие на баланс не даёт
  // двум одновременным запросам вывести один и тот же остаток.
  const created = await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: sellerId, balanceSats: { gte: amountSats } },
      data: { balanceSats: { decrement: amountSats } },
    })

    if (claimed.count === 0) return null

    return tx.payout.create({
      data: {
        asset: "BTC",
        kind: "SELLER_WITHDRAWAL",
        status: "PENDING",
        recipientId: sellerId,
        amountSats,
        feeSats: quote.feeSats,
        netSats,
        feeRate: quote.feeRate,
        destination,
        method: "BTCPAY",
      },
    })
  })

  if (!created) return { result: "insufficient_funds" }

  try {
    const payout = await createPayout({ destination, amountSats: netSats })

    const saved = await prisma.payout.update({
      where: { id: created.id },
      data: { providerPayoutId: payout.id, status: fromProviderState(payout.state) },
    })

    return { result: "created", payout: saved }
  } catch (error) {
    console.error(`Заявка на вывод ${created.id} не принята BTCPay:`, error)

    // Деньги не ушли — возвращаем их продавцу и закрываем заявку.
    await prisma.$transaction(async (tx) => {
      const failed = await tx.payout.updateMany({
        where: { id: created.id, status: "PENDING" },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          note: "BTCPay не принял заявку на выплату",
        },
      })

      if (failed.count === 1) {
        await tx.user.update({
          where: { id: sellerId },
          data: { balanceSats: { increment: amountSats } },
        })
      }
    })

    return {
      result: "provider_error",
      message:
        error instanceof BTCPayError
          ? `BTCPay отклонил заявку (${error.status})`
          : "BTCPay недоступен",
    }
  }
}

/** Состояние выплаты в BTCPay в терминах нашей заявки. */
export function fromProviderState(
  state: BTCPayPayoutState
): "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" {
  switch (state) {
    case "AwaitingApproval":
      return "PENDING"
    case "AwaitingPayment":
    case "InProgress":
      return "PROCESSING"
    case "Completed":
      return "COMPLETED"
    case "Cancelled":
      return "FAILED"
    default:
      return "PENDING"
  }
}

/**
 * Приводит заявку к тому, что о ней думает BTCPay. Отменённая выплата
 * возвращает сатоши на баланс — ровно один раз, за это отвечает условие
 * на текущий статус.
 */
export async function syncPayoutWithProvider(
  payoutId: string,
  state?: BTCPayPayoutState,
  proof?: { txId?: string | null }
): Promise<{ status: string } | null> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } })

  if (!payout || payout.asset !== "BTC") return null

  let providerState = state
  let txId = proof?.txId ?? null

  if (!providerState) {
    if (!payout.providerPayoutId) return { status: payout.status }

    try {
      const remote = await getPayout(payout.providerPayoutId)
      providerState = remote.state
      txId = remote.paymentProof?.id ?? null
    } catch (error) {
      console.error(`Не удалось прочитать выплату ${payoutId}:`, error)
      return { status: payout.status }
    }
  }

  const status = fromProviderState(providerState)

  if (status === payout.status && !txId) return { status: payout.status }

  if (status === "FAILED") {
    // Выплата отменена: списанные сатоши возвращаются продавцу.
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.payout.updateMany({
        where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          note: payout.note ?? "Выплата отменена",
        },
      })

      if (claimed.count === 1 && payout.kind === "SELLER_WITHDRAWAL") {
        await tx.user.update({
          where: { id: payout.recipientId },
          data: { balanceSats: { increment: payout.amountSats ?? 0 } },
        })
      }
    })

    return { status: "FAILED" }
  }

  await prisma.payout.updateMany({
    where: { id: payoutId, status: { not: "FAILED" } },
    data: {
      status,
      ...(txId ? { txId } : {}),
      ...(status === "COMPLETED" ? { processedAt: new Date() } : {}),
    },
  })

  return { status }
}

/** Отмена заявки администратором, пока она не подписана. */
export async function cancelWithdrawal(
  payoutId: string,
  note: string
): Promise<{ result: "cancelled" | "not_found" | "not_pending" | "provider_error" }> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } })

  if (!payout || payout.asset !== "BTC") return { result: "not_found" }
  if (payout.status === "COMPLETED" || payout.status === "FAILED") {
    return { result: "not_pending" }
  }

  if (payout.providerPayoutId) {
    try {
      await cancelPayout(payout.providerPayoutId)
    } catch (error) {
      // Уже оплаченную выплату BTCPay отменить не даст — и правильно:
      // иначе мы вернули бы продавцу деньги, которые уже ушли.
      console.error(`Не удалось отменить выплату ${payoutId} в BTCPay:`, error)
      return { result: "provider_error" }
    }
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payout.updateMany({
      where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", processedAt: new Date(), note },
    })

    if (claimed.count === 1 && payout.kind === "SELLER_WITHDRAWAL") {
      await tx.user.update({
        where: { id: payout.recipientId },
        data: { balanceSats: { increment: payout.amountSats ?? 0 } },
      })
    }
  })

  return { result: "cancelled" }
}

/**
 * Задача на ручной возврат покупателю.
 *
 * Полученный биткоин нельзя вернуть запросом к провайдеру: транзакция
 * необратима, а обратный перевод требует адреса покупателя, которого у
 * нас нет. Поэтому обязательство площадки записывается заявкой — она
 * попадает в тот же журнал, что и выводы продавцов, и закрывается
 * администратором после отправки.
 *
 * Вызывается внутри транзакции сделки, чтобы возврат и обязательство
 * появлялись вместе.
 */
export async function recordManualRefund(
  tx: Prisma.TransactionClient,
  {
    purchaseId,
    buyerId,
    sats,
    note,
  }: { purchaseId: string; buyerId: string; sats: number; note: string }
): Promise<void> {
  if (!Number.isFinite(sats) || sats <= 0) return

  await tx.payout.create({
    data: {
      asset: "BTC",
      kind: "BUYER_REFUND",
      status: "PENDING",
      recipientId: buyerId,
      purchaseId,
      amountSats: Math.round(sats),
      netSats: Math.round(sats),
      note,
      method: "MANUAL",
    },
  })
}

/** Закрытие ручного возврата: администратор отправил деньги сам. */
export async function completeManualRefund(
  payoutId: string,
  { txId, destination }: { txId?: string; destination?: string }
): Promise<{ result: "completed" | "not_found" | "not_pending" }> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } })

  if (!payout || payout.kind !== "BUYER_REFUND") return { result: "not_found" }

  const claimed = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      ...(txId ? { txId } : {}),
      ...(destination ? { destination } : {}),
    },
  })

  return claimed.count === 1 ? { result: "completed" } : { result: "not_pending" }
}
