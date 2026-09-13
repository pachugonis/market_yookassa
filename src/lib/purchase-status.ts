import type { PurchaseStatus } from "@prisma/client"

// Покупка — это то, за что заплачено. Брошенная или отменённая оплата
// (PENDING, FAILED) остаётся в базе, чтобы поздний платёж по ней всё
// равно выдал товар, но показывать её как покупку нигде не нужно.
export const PAID_PURCHASE_STATUSES: PurchaseStatus[] = [
  "HELD",
  "COMPLETED",
  "REFUNDED",
]

export const paidPurchaseWhere = {
  status: { in: PAID_PURCHASE_STATUSES },
}
