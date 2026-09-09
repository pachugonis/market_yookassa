import { prisma } from "@/lib/prisma"
import {
  CloudPaymentsError,
  getTransaction,
  paymentPublicId,
  voidPayment,
  type CloudPaymentsTransaction,
} from "@/lib/cloudpayments"
import { isCloudPaymentsPayoutConfigured } from "@/lib/payments/config"

/**
 * Привязка карты продавца для выплат по «Безопасной сделке».
 *
 * Токен карты CloudPayments выдаёт только по факту оплаты картой —
 * отдельного метода «сохранить карту» нет. Поэтому карта проверяется
 * авторизацией на символическую сумму с `tokenize: true`: деньги
 * замораживаются, мы забираем токен и тут же снимаем холд, так что
 * с продавца ничего не списывается.
 *
 * Связь транзакции с продавцом — через идентификатор записи о привязке:
 * он уходит в номер заказа (`externalId`), создаётся на сервере и
 * подобрать его нельзя. Без этого любой мог бы привязать свою карту
 * к чужому кабинету и получать чужие выплаты.
 */

/** Сумма проверочной авторизации в рублях. */
export const CARD_BINDING_AMOUNT = readPositiveInt(
  process.env.CLOUDPAYMENTS_CARD_BINDING_AMOUNT,
  1
)

/** Дольше этого срока незавершённую привязку начинаем заново. */
const BINDING_TTL_MS = 30 * 60 * 1000

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export type CardBindingOutcome =
  | { result: "bound"; cardMask: string | null }
  | { result: "pending" }
  | { result: "not_found" }
  | { result: "declined" }
  | { result: "payment_error" }

/**
 * Параметры виджета для проверочной авторизации. Возвращаются клиенту,
 * поэтому здесь только то, что и так публично: секретов нет.
 */
export interface CardBindingIntent {
  bindingId: string
  publicTerminalId: string
  amount: number
  accountId: string
}

/**
 * Начинает привязку. Свежая незавершённая попытка переиспользуется:
 * продавец мог закрыть виджет и нажать кнопку ещё раз.
 */
export async function startCardBinding(
  userId: string
): Promise<CardBindingIntent> {
  const existing = await prisma.payoutCardBinding.findFirst({
    where: {
      userId,
      provider: "CLOUDPAYMENTS",
      status: "PENDING",
      amount: CARD_BINDING_AMOUNT,
      createdAt: { gt: new Date(Date.now() - BINDING_TTL_MS) },
      transactionId: null,
    },
    orderBy: { createdAt: "desc" },
  })

  const binding =
    existing ??
    (await prisma.payoutCardBinding.create({
      data: { userId, provider: "CLOUDPAYMENTS", amount: CARD_BINDING_AMOUNT },
    }))

  return {
    bindingId: binding.id,
    publicTerminalId: paymentPublicId(),
    amount: binding.amount,
    accountId: userId,
  }
}

/**
 * Завершает привязку по результату проверочной авторизации.
 *
 * Вызывается двумя путями — из уведомления и со страницы продавца,
 * когда виджет вернул номер транзакции. Оба идемпотентны: токен
 * сохраняется один раз, повторный вызов только сообщает результат.
 */
export async function completeCardBinding(
  bindingId: string,
  transactionId: string
): Promise<CardBindingOutcome> {
  const binding = await prisma.payoutCardBinding.findUnique({
    where: { id: bindingId },
  })

  if (!binding || binding.provider !== "CLOUDPAYMENTS") {
    return { result: "not_found" }
  }

  if (binding.status === "COMPLETED") {
    return { result: "bound", cardMask: binding.cardMask }
  }

  let transaction: CloudPaymentsTransaction

  try {
    transaction = await getTransaction(Number(transactionId))
  } catch (error) {
    console.error(`Не удалось прочитать транзакцию ${transactionId}:`, error)
    return { result: "payment_error" }
  }

  // Транзакция должна относиться именно к этой привязке и к этой сумме.
  if (transaction.InvoiceId !== binding.id) {
    console.warn(
      `Транзакция ${transactionId} не относится к привязке ${binding.id}`
    )
    return { result: "not_found" }
  }

  if (Math.round(Number(transaction.Amount)) !== binding.amount) {
    console.warn(`Привязка ${binding.id}: неожиданная сумма ${transaction.Amount}`)
    return { result: "declined" }
  }

  if (transaction.Status === "Declined" || transaction.Status === "Cancelled") {
    await prisma.payoutCardBinding.updateMany({
      where: { id: binding.id, status: "PENDING" },
      data: { status: "FAILED", transactionId: String(transaction.TransactionId) },
    })
    return { result: "declined" }
  }

  // Карта ещё проверяется (например, идёт 3-D Secure).
  if (transaction.Status !== "Authorized" && transaction.Status !== "Completed") {
    return { result: "pending" }
  }

  if (!transaction.Token) {
    console.error(
      `Привязка ${binding.id}: CloudPayments не вернул токен карты — ` +
        "проверьте, что в запросе включена токенизация"
    )
    return { result: "payment_error" }
  }

  const cardMask = transaction.CardLastFour ?? null

  await prisma.$transaction(async (tx) => {
    // Условие по статусу — замок: параллельный вызов увидит COMPLETED
    // и не станет сохранять токен второй раз.
    const claimed = await tx.payoutCardBinding.updateMany({
      where: { id: binding.id, status: "PENDING" },
      data: {
        status: "COMPLETED",
        transactionId: String(transaction.TransactionId),
        cardMask,
        completedAt: new Date(),
      },
    })

    if (claimed.count === 0) return

    await tx.user.update({
      where: { id: binding.userId },
      data: {
        cloudpaymentsPayoutToken: transaction.Token,
        cloudpaymentsPayoutCard: cardMask,
        cloudpaymentsPayoutBoundAt: new Date(),
      },
    })
  })

  // Деньги продавца не должны уйти: снимаем проверочный холд. Если
  // авторизация уже подтверждена (одностадийный терминал), отменять
  // нечего — сумма символическая, и токен мы уже получили.
  if (transaction.Status === "Authorized") {
    try {
      await voidPayment(
        transaction.TransactionId,
        `bind-card-void-${binding.id}`
      )
    } catch (error) {
      console.error(
        `Не удалось снять проверочный холд по привязке ${binding.id}:`,
        error instanceof CloudPaymentsError ? error.body : error
      )
    }
  }

  return { result: "bound", cardMask }
}

/** Отвязка карты: выплаты снова пойдут через внутренний баланс. */
export async function unbindCard(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      cloudpaymentsPayoutToken: null,
      cloudpaymentsPayoutCard: null,
      cloudpaymentsPayoutBoundAt: null,
    },
  })
}

/** Доступна ли привязка карты: без терминала выплат она бессмысленна. */
export function isCardBindingAvailable(): boolean {
  return isCloudPaymentsPayoutConfigured()
}

/**
 * Ждёт ли эта проверочная авторизация обработки. Нужно вебхуку, чтобы
 * отличить платёж за товар от привязки карты.
 */
export async function findPendingBinding(bindingId: string) {
  return prisma.payoutCardBinding.findUnique({ where: { id: bindingId } })
}
