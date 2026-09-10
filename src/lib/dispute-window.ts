/**
 * Срок обращения по завершённой сделке.
 *
 * Пока деньги в холде, спор осмыслен всегда: сделка не закрыта и
 * возвращать нечего — достаточно снять заморозку. После списания
 * появляется срок: возврат уже стоит площадке живых денег, а сделку
 * нельзя оставлять открытой навсегда.
 *
 * Особенно это важно при мгновенном списании (`Purchase.instantCapture`,
 * режим одного продавца): холда, который защищал покупателя, там нет —
 * его роль целиком играет это окно.
 *
 * Модуль намеренно без обращений к базе: те же сутки считает и сервер
 * при открытии спора, и библиотека покупателя, когда решает, показывать
 * ли кнопку.
 */

/** Сколько часов после списания можно открыть спор. */
export const DISPUTE_WINDOW_HOURS = 24

export const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_HOURS * 60 * 60 * 1000

type PurchaseTimestamps = {
  /** Момент списания. У сделок, оплаченных до эскроу, его нет. */
  confirmedAt: Date | string | null
  createdAt: Date | string
}

/** Момент, после которого спор по списанной сделке уже не открыть. */
export function disputeWindowEndsAt(purchase: PurchaseTimestamps): Date {
  const since = purchase.confirmedAt ?? purchase.createdAt
  return new Date(new Date(since).getTime() + DISPUTE_WINDOW_MS)
}

/** Не вышел ли срок обращения по списанной сделке. */
export function isDisputeWindowOpen(
  purchase: PurchaseTimestamps,
  now: Date = new Date()
): boolean {
  return now.getTime() <= disputeWindowEndsAt(purchase).getTime()
}
