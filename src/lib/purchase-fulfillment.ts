import { v4 as uuidv4 } from "uuid"
import { Prisma, type PaymentProvider } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getGateway } from "@/lib/payments"
import type { ProviderPayment } from "@/lib/payments/types"

/**
 * Сделка живёт по эскроу-схеме: двухэтапная оплата + сплитование.
 *
 *   1. Покупатель оплачивает заказ  → холд, деньги заморожены на его
 *      карте (статус покупки HELD).
 *   2. Товар передаётся покупателю  → выдаются файл и лицензионный ключ.
 *   3. Покупатель подтверждает приём → списание со сплитованием:
 *      выручка уходит на счёт продавца, комиссия остаётся площадке.
 *
 * Как именно провайдер это делает, знает только его шлюз
 * (`src/lib/payments`): ЮKassa разводит деньги внутри capture через
 * transfers, CloudPayments — отдельной выплатой из накопления
 * «Безопасной сделки». Здесь собраны переходы между состояниями.
 * Каждый из них может прийти одновременно из вебхука, из опроса статуса
 * и из действия пользователя, поэтому переход выполняется атомарно
 * и ровно один раз.
 */

export type FulfillmentOutcome =
  | { result: "held"; downloadToken: string }
  | { result: "already_held" }
  | { result: "not_pending" }
  | { result: "not_found" }
  | { result: "no_license_keys" }

export type SettleOutcome =
  | { result: "settled"; capturedAmount: number }
  | { result: "already_settled" }
  | { result: "not_held" }
  | { result: "not_found" }
  | { result: "locked" }
  | { result: "hold_expired" }
  | { result: "invalid_amount" }
  | { result: "payment_error" }

export type ReleaseOutcome =
  | { result: "released" }
  | { result: "already_released" }
  | { result: "not_held" }
  | { result: "not_found" }
  | { result: "payment_error" }

export type RefundOutcome =
  | { result: "refunded"; amount: number }
  | { result: "not_completed" }
  | { result: "not_found" }
  | { result: "invalid_amount" }
  | { result: "payment_error" }

const DOWNLOAD_VALIDITY_DAYS = 30
const LICENSE_KEY_RETRIES = 5

/** Через сколько дней сделка подтверждается сама, если покупатель молчит. */
const AUTO_CONFIRM_DAYS = readPositiveNumber(
  process.env.ESCROW_AUTO_CONFIRM_DAYS,
  3
)

/**
 * Запас до конца холда. Подтверждать нужно раньше, чем провайдер снимет
 * заморозку сам: после expires_at деньги уже не списать.
 */
const HOLD_SAFETY_MARGIN_MS = 6 * 60 * 60 * 1000

/** Дольше этого срока замок на capture считаем брошенным. */
const CAPTURE_LOCK_TIMEOUT_MS = 2 * 60 * 1000

function readPositiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Момент автоподтверждения: либо через AUTO_CONFIRM_DAYS, либо раньше —
 * если холд истекает быстрее.
 */
export function calculateAutoConfirmAt(
  heldAt: Date,
  holdExpiresAt: Date | null
): Date {
  const byPolicy = new Date(
    heldAt.getTime() + AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000
  )

  if (!holdExpiresAt) return byPolicy

  const lastSafeMoment = new Date(holdExpiresAt.getTime() - HOLD_SAFETY_MARGIN_MS)
  return byPolicy < lastSafeMoment ? byPolicy : lastSafeMoment
}

/**
 * Шаг 1→2: средства заморожены. Покупка переходит в HELD, покупатель
 * получает товар. Деньги продавцу здесь НЕ начисляются — только после
 * подтверждения приёма.
 */
export async function holdPurchase(
  purchaseId: string,
  providerPaymentId: string,
  {
    holdExpiresAt,
    accumulationId,
  }: { holdExpiresAt?: Date | null; accumulationId?: string | null } = {}
): Promise<FulfillmentOutcome> {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { product: { select: { id: true, sellerId: true, hasLicenseKeys: true } } },
  })

  if (!purchase) return { result: "not_found" }
  if (purchase.status === "HELD" || purchase.status === "COMPLETED") {
    return { result: "already_held" }
  }
  if (purchase.status !== "PENDING") return { result: "not_pending" }

  const downloadToken = uuidv4()
  const downloadExpiresAt = new Date()
  downloadExpiresAt.setDate(downloadExpiresAt.getDate() + DOWNLOAD_VALIDITY_DAYS)

  const heldAt = new Date()
  const expiresAt = holdExpiresAt ?? null

  try {
    return await prisma.$transaction(async (tx) => {
      // Условный UPDATE — это и есть замок: параллельная транзакция
      // либо ждёт нас, либо увидит статус HELD и обновит 0 строк.
      const claimed = await tx.purchase.updateMany({
        where: { id: purchase.id, status: "PENDING" },
        data: {
          status: "HELD",
          providerPaymentId,
          downloadToken,
          downloadExpiresAt,
          heldAt,
          holdExpiresAt: expiresAt,
          autoConfirmAt: calculateAutoConfirmAt(heldAt, expiresAt),
          ...(accumulationId ? { escrowAccumulationId: accumulationId } : {}),
        },
      })

      if (claimed.count === 0) {
        return { result: "already_held" } as const
      }

      // Шаг 2: товар передаётся покупателю сразу после заморозки денег —
      // именно его приём он и подтверждает на шаге 3.
      if (purchase.product.hasLicenseKeys) {
        const licenseKeyId = await claimLicenseKey(tx, purchase.productId)

        if (!licenseKeyId) {
          // Ключей не осталось — откатываем всю транзакцию и
          // помечаем покупку как неуспешную вне её.
          throw new NoLicenseKeysError()
        }

        await tx.purchase.update({
          where: { id: purchase.id },
          data: { licenseKeyId },
        })

        const remainingKeys = await tx.licenseKey.count({
          where: { productId: purchase.productId, isSold: false },
        })

        if (remainingKeys === 0) {
          await tx.product.update({
            where: { id: purchase.productId },
            data: { status: "INACTIVE" },
          })
        }
      }

      await tx.product.update({
        where: { id: purchase.productId },
        data: { downloadCount: { increment: 1 } },
      })

      return { result: "held", downloadToken } as const
    })
  } catch (error) {
    if (error instanceof NoLicenseKeysError) {
      await prisma.purchase.updateMany({
        where: { id: purchase.id, status: "PENDING" },
        data: { status: "FAILED" },
      })
      // Холд снимаем, иначе деньги останутся замороженными до expires_at.
      await safeCancel(purchase.paymentProvider, providerPaymentId, purchase.id)
      return { result: "no_license_keys" }
    }
    throw error
  }
}

/**
 * Шаг 3: подтверждение приёма товара — списываем замороженные средства
 * и распределяем их через сплитование.
 *
 * `amount` меньше суммы холда означает частичный возврат: провайдер
 * спишет только его, а разницу вернёт покупателю.
 */
export async function settlePurchase(
  purchaseId: string,
  {
    amount,
    confirmedBy,
  }: { amount?: number; confirmedBy: "BUYER" | "AUTO" | "DISPUTE" }
): Promise<SettleOutcome> {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { product: { select: { sellerId: true } } },
  })

  if (!purchase) return { result: "not_found" }
  if (purchase.status === "COMPLETED") return { result: "already_settled" }
  if (purchase.status !== "HELD") return { result: "not_held" }
  if (!purchase.providerPaymentId) return { result: "not_held" }

  const captureAmount = amount ?? purchase.amount

  if (
    !Number.isInteger(captureAmount) ||
    captureAmount <= 0 ||
    captureAmount > purchase.amount
  ) {
    return { result: "invalid_amount" }
  }

  // Замок вокруг обращения к API: внешний вызов нельзя держать внутри
  // транзакции, поэтому право на capture захватывается отдельно.
  const lockedAt = new Date()
  const staleLockBefore = new Date(lockedAt.getTime() - CAPTURE_LOCK_TIMEOUT_MS)

  const lock = await prisma.purchase.updateMany({
    where: {
      id: purchase.id,
      status: "HELD",
      OR: [{ captureStartedAt: null }, { captureStartedAt: { lt: staleLockBefore } }],
    },
    data: { captureStartedAt: lockedAt },
  })

  if (lock.count === 0) return { result: "locked" }

  // Комиссия удерживается пропорционально фактически списанной сумме.
  const commission = Math.round(
    (purchase.commission * captureAmount) / purchase.amount
  )

  const gateway = getGateway(purchase.paymentProvider)
  const paymentId = purchase.providerPaymentId

  let captured
  try {
    captured = await gateway.capture({
      purchaseId: purchase.id,
      paymentId,
      amount: captureAmount,
      commission,
      splitAccountId: purchase.splitAccountId,
      sellerId: purchase.product.sellerId,
      accumulationId: purchase.escrowAccumulationId,
    })
  } catch (error) {
    // Платёж мог быть подтверждён или отменён другим путём — спрашиваем
    // провайдера, что с ним на самом деле, прежде чем считать это сбоем.
    const actual = await safeGetPayment(purchase.paymentProvider, paymentId)

    if (actual?.status === "succeeded") {
      captured = {
        status: "succeeded" as const,
        // Списание прошло не нашим вызовом: доля продавца ушла к нему
        // только если провайдер разводит деньги самим подтверждением.
        splitSettled: gateway.splitHappensWithCapture
          ? Boolean(purchase.splitAccountId)
          : Boolean(purchase.splitPayoutId),
      }
    } else {
      await releaseCaptureLock(purchase.id)

      if (actual?.status === "canceled") {
        await markHoldExpired(purchase.id)
        return { result: "hold_expired" }
      }

      console.error(`Capture failed for purchase ${purchase.id}:`, error)
      return { result: "payment_error" }
    }
  }

  if (captured.status !== "succeeded") {
    await releaseCaptureLock(purchase.id)

    if (captured.status === "canceled") {
      await markHoldExpired(purchase.id)
      return { result: "hold_expired" }
    }

    return { result: "payment_error" }
  }

  await finalizeCapture({
    purchaseId: purchase.id,
    sellerId: purchase.product.sellerId,
    totalAmount: purchase.amount,
    capturedAmount: captureAmount,
    commission,
    splitSettled: captured.splitSettled,
    splitPayoutId: captured.splitPayoutId ?? null,
    confirmedBy,
  })

  return { result: "settled", capturedAmount: captureAmount }
}

/**
 * Перевод HELD → COMPLETED после успешного списания. Вынесен отдельно,
 * потому что о списании можно узнать двумя путями: из нашего же вызова
 * capture и из уведомления провайдера.
 */
async function finalizeCapture({
  purchaseId,
  sellerId,
  totalAmount,
  capturedAmount,
  commission,
  splitSettled,
  splitPayoutId,
  confirmedBy,
}: {
  purchaseId: string
  sellerId: string
  totalAmount: number
  capturedAmount: number
  commission: number
  splitSettled: boolean
  splitPayoutId: string | null
  confirmedBy: string
}): Promise<boolean> {
  const sellerEarnings = capturedAmount - commission

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.purchase.updateMany({
      where: { id: purchaseId, status: "HELD" },
      data: {
        status: "COMPLETED",
        commission,
        sellerEarnings,
        capturedAmount,
        refundedAmount: totalAmount - capturedAmount,
        confirmedAt: new Date(),
        confirmedBy,
        captureStartedAt: null,
        ...(splitPayoutId ? { splitPayoutId } : {}),
      },
    })

    // Параллельный запрос уже финализировал сделку — второй раз деньги
    // не начисляем.
    if (claimed.count === 0) return false

    // Внутренний баланс пополняется только там, где сплитования не было:
    // при сплите деньги уже ушли на счёт продавца у провайдера.
    if (!splitSettled && sellerEarnings > 0) {
      await tx.user.update({
        where: { id: sellerId },
        data: { balance: { increment: sellerEarnings } },
      })
    }

    return true
  })
}

/**
 * Приводит покупку в соответствие с тем, что о платеже думает провайдер.
 * Источник истины — всегда ответ API, а не тело уведомления.
 */
export async function syncPurchaseWithPayment(
  purchaseId: string,
  payment: ProviderPayment
): Promise<
  | { result: "held"; downloadToken: string }
  | { result: "settled"; capturedAmount: number }
  | { result: "released" }
  | { result: "failed" }
  | { result: "no_license_keys" }
  | { result: "unchanged" }
> {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { product: { select: { sellerId: true } } },
  })

  if (!purchase) return { result: "unchanged" }

  if (payment.status === "waiting_for_capture") {
    if (purchase.status !== "PENDING") return { result: "unchanged" }

    const outcome = await holdPurchase(purchase.id, payment.id, {
      holdExpiresAt: payment.expiresAt,
      accumulationId: payment.accumulationId,
    })

    if (outcome.result === "held") {
      return { result: "held", downloadToken: outcome.downloadToken }
    }
    if (outcome.result === "no_license_keys") {
      return { result: "no_license_keys" }
    }
    return { result: "unchanged" }
  }

  if (payment.status === "succeeded") {
    // Одноэтапный сценарий: платёж мог быть подтверждён и без прохода
    // через HELD (например, старой ссылкой на оплату).
    if (purchase.status === "PENDING") {
      const outcome = await holdPurchase(purchase.id, payment.id, {
        holdExpiresAt: null,
        accumulationId: payment.accumulationId,
      })

      if (outcome.result === "no_license_keys") {
        return { result: "no_license_keys" }
      }
      if (outcome.result === "not_found" || outcome.result === "not_pending") {
        return { result: "unchanged" }
      }
    }

    const current = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      select: {
        status: true,
        amount: true,
        commission: true,
        splitAccountId: true,
        splitPayoutId: true,
        captureStartedAt: true,
      },
    })

    if (!current || current.status !== "HELD") return { result: "unchanged" }

    // Подтверждение прямо сейчас выполняем мы сами: там же будет
    // и выплата продавцу. Вмешиваться нельзя — иначе выручка уйдёт
    // и на его счёт, и на внутренний баланс.
    if (
      current.captureStartedAt &&
      current.captureStartedAt.getTime() > Date.now() - CAPTURE_LOCK_TIMEOUT_MS
    ) {
      return { result: "unchanged" }
    }

    // Фактически списанная сумма может быть меньше захолдированной —
    // например, при частичном возврате по спору.
    const capturedAmount = Math.round(payment.amount)
    const safeCaptured =
      Number.isFinite(capturedAmount) && capturedAmount > 0
        ? Math.min(capturedAmount, current.amount)
        : current.amount

    const commission = Math.round(
      (current.commission * safeCaptured) / current.amount
    )

    const splitSettled = getGateway(purchase.paymentProvider)
      .splitHappensWithCapture
      ? Boolean(current.splitAccountId)
      : Boolean(current.splitPayoutId)

    if (current.splitAccountId && !splitSettled) {
      // Списание прошло мимо площадки (например, из кабинета провайдера),
      // и выплата продавцу не сделана. Начисляем выручку на баланс, иначе
      // она зависнет: разбираться с накоплением придётся вручную.
      console.warn(
        `Покупка ${purchase.id}: списание без выплаты продавцу, выручка ушла на внутренний баланс`
      )
    }

    const finalized = await finalizeCapture({
      purchaseId: purchase.id,
      sellerId: purchase.product.sellerId,
      totalAmount: current.amount,
      capturedAmount: safeCaptured,
      commission,
      splitSettled,
      splitPayoutId: null,
      confirmedBy: purchase.confirmedBy ?? "WEBHOOK",
    })

    return finalized
      ? { result: "settled", capturedAmount: safeCaptured }
      : { result: "unchanged" }
  }

  if (payment.status === "canceled") {
    if (purchase.status === "HELD") {
      await markHoldExpired(purchase.id)
      return { result: "released" }
    }

    if (purchase.status === "PENDING") {
      await failPurchase(purchase.id)
      return { result: "failed" }
    }
  }

  return { result: "unchanged" }
}

/**
 * Снятие холда без списания: деньги разблокируются на карте покупателя.
 * Используется при возврате по спору до подтверждения сделки.
 */
export async function releaseHold(
  purchaseId: string
): Promise<ReleaseOutcome> {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      status: true,
      paymentProvider: true,
      providerPaymentId: true,
      amount: true,
    },
  })

  if (!purchase) return { result: "not_found" }
  if (purchase.status === "REFUNDED" || purchase.status === "FAILED") {
    return { result: "already_released" }
  }
  if (purchase.status !== "HELD" || !purchase.providerPaymentId) {
    return { result: "not_held" }
  }

  const gateway = getGateway(purchase.paymentProvider)

  try {
    const payment = await gateway.cancel(purchase.providerPaymentId, purchase.id)

    if (payment.status !== "canceled") {
      return { result: "payment_error" }
    }
  } catch (error) {
    const actual = await safeGetPayment(
      purchase.paymentProvider,
      purchase.providerPaymentId
    )

    if (actual?.status !== "canceled") {
      console.error(`Hold release failed for purchase ${purchase.id}:`, error)
      return { result: "payment_error" }
    }
  }

  const claimed = await prisma.purchase.updateMany({
    where: { id: purchase.id, status: "HELD" },
    data: {
      status: "REFUNDED",
      refundedAmount: purchase.amount,
      capturedAmount: 0,
      captureStartedAt: null,
    },
  })

  return claimed.count === 0
    ? { result: "already_released" }
    : { result: "released" }
}

/**
 * Возврат уже списанных денег. Нужен, когда сделка была подтверждена,
 * а спор решён в пользу покупателя.
 */
export async function refundCapturedPurchase(
  purchaseId: string,
  amount: number
): Promise<RefundOutcome> {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { product: { select: { sellerId: true } } },
  })

  if (!purchase) return { result: "not_found" }
  if (purchase.status !== "COMPLETED" || !purchase.providerPaymentId) {
    return { result: "not_completed" }
  }

  const captured = purchase.capturedAmount ?? purchase.amount
  const refundable = captured - purchase.refundedAmount

  if (!Number.isInteger(amount) || amount <= 0 || amount > refundable) {
    return { result: "invalid_amount" }
  }

  // Комиссия площадки возвращается пропорционально возвращаемой сумме.
  const commissionShare = Math.round((purchase.commission * amount) / captured)
  const sellerDeduction = amount - commissionShare

  const gateway = getGateway(purchase.paymentProvider)

  // Часть провайдеров забирает долю продавца прямо с его счёта; у
  // остальных возврат делает площадка, и долг продавца остаётся у нас.
  const reclaimedFromSeller =
    gateway.refundReclaimsSellerShare && Boolean(purchase.splitAccountId)

  let refundId: string | null = null

  try {
    const refund = await gateway.refund({
      purchaseId: purchase.id,
      paymentId: purchase.providerPaymentId,
      amount,
      commission: commissionShare,
      splitAccountId: purchase.splitAccountId,
      alreadyRefunded: purchase.refundedAmount,
    })

    refundId = refund.refundId
  } catch (error) {
    console.error(`Refund failed for purchase ${purchase.id}:`, error)
    return { result: "payment_error" }
  }

  const totalRefunded = purchase.refundedAmount + amount

  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        refundedAmount: totalRefunded,
        status: totalRefunded >= captured ? "REFUNDED" : "COMPLETED",
        // Уведомление об этом же возврате придёт следом — по списку
        // операций оно поймёт, что сумма уже учтена.
        ...(refundId ? { refundTransactionIds: { push: refundId } } : {}),
      },
    })

    // Выручка, оставшаяся у нас, возвращается с внутреннего баланса.
    // Недостача уходит в минус и гасится следующими продажами: иначе
    // деньги возникли бы из воздуха.
    if (!reclaimedFromSeller && sellerDeduction > 0) {
      await tx.user.update({
        where: { id: purchase.product.sellerId },
        data: { balance: { decrement: sellerDeduction } },
      })
    }
  })

  return { result: "refunded", amount }
}

/** Помечает покупку как неуспешную, если она ещё не завершена. */
export async function failPurchase(purchaseId: string): Promise<void> {
  await prisma.purchase.updateMany({
    where: { id: purchaseId, status: { in: ["PENDING"] } },
    data: { status: "FAILED" },
  })
}

/** Холд снят на стороне провайдера — деньги вернулись покупателю. */
export async function markHoldExpired(purchaseId: string): Promise<void> {
  await prisma.purchase.updateMany({
    where: { id: purchaseId, status: "HELD" },
    data: {
      status: "REFUNDED",
      capturedAmount: 0,
      captureStartedAt: null,
    },
  })
}

async function releaseCaptureLock(purchaseId: string): Promise<void> {
  await prisma.purchase.updateMany({
    where: { id: purchaseId, status: "HELD" },
    data: { captureStartedAt: null },
  })
}

async function safeGetPayment(provider: PaymentProvider, paymentId: string) {
  try {
    return await getGateway(provider).getPayment(paymentId)
  } catch (error) {
    console.error(`Failed to read payment ${paymentId}:`, error)
    return null
  }
}

async function safeCancel(
  provider: PaymentProvider,
  paymentId: string,
  purchaseId: string
) {
  try {
    await getGateway(provider).cancel(paymentId, purchaseId)
  } catch (error) {
    console.error(`Failed to cancel hold for purchase ${purchaseId}:`, error)
  }
}

class NoLicenseKeysError extends Error {}

/**
 * Захватывает свободный лицензионный ключ. Условие `isSold: false`
 * в UPDATE не даёт выдать один ключ двум покупателям: проигравшая
 * транзакция обновит 0 строк и возьмёт следующий ключ.
 */
async function claimLicenseKey(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<string | null> {
  for (let attempt = 0; attempt < LICENSE_KEY_RETRIES; attempt++) {
    const candidate = await tx.licenseKey.findFirst({
      where: { productId, isSold: false },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })

    if (!candidate) return null

    const claimed = await tx.licenseKey.updateMany({
      where: { id: candidate.id, isSold: false },
      data: { isSold: true, soldAt: new Date() },
    })

    if (claimed.count === 1) return candidate.id
  }

  return null
}
