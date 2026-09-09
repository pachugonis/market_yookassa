import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { paymentPublicId } from "@/lib/cloudpayments"
import { CloudPaymentsCheckout } from "./checkout"

/**
 * Страница оплаты через CloudPayments.
 *
 * В отличие от ЮKassa, провайдер не даёт ссылку на свою платёжную
 * страницу: оплата запускается виджетом. Параметры сделки виджет
 * получает отсюда, с сервера, а не из запроса покупателя — а сумму
 * CloudPayments дополнительно переспрашивает check-уведомлением.
 */

export const dynamic = "force-dynamic"

export default async function CloudPaymentsCheckoutPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>
}) {
  const { purchaseId } = await params
  const session = await auth()

  if (!session?.user) {
    redirect(`/login?callbackUrl=/payment/cloudpayments/${purchaseId}`)
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { product: { select: { id: true, title: true } } },
  })

  if (!purchase || purchase.buyerId !== session.user.id) {
    notFound()
  }

  if (purchase.paymentProvider !== "CLOUDPAYMENTS") {
    notFound()
  }

  // Оплата уже прошла (или заказ закрыт) — на странице оплаты делать нечего.
  if (purchase.status !== "PENDING") {
    redirect(`/payment/success?purchaseId=${purchase.id}`)
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const successUrl = `${baseUrl}/payment/success?purchaseId=${purchase.id}`

  return (
    <CloudPaymentsCheckout
      productTitle={purchase.product.title}
      productId={purchase.product.id}
      amount={purchase.amount}
      successUrl={successUrl}
      intent={{
        publicTerminalId: paymentPublicId(),
        amount: purchase.amount,
        currency: "RUB",
        culture: "ru-RU",
        // Двухстадийная схема: деньги замораживаются, списание —
        // после подтверждения приёма товара.
        paymentSchema: "Dual",
        description: `Покупка: ${purchase.product.title}`,
        // Приходит в уведомлениях как InvoiceId и связывает транзакцию
        // с покупкой.
        externalId: purchase.id,
        successRedirectUrl: successUrl,
        failRedirectUrl: `${baseUrl}/products/${purchase.product.id}`,
        userInfo: { email: session.user.email ?? undefined },
        metadata: {
          purchaseId: purchase.id,
          productId: purchase.product.id,
          buyerId: purchase.buyerId,
        },
        // Накопление «Безопасной сделки» создаётся, только если продавец
        // подключил карту для выплат: из него ему уйдёт его доля.
        escrow: purchase.splitAccountId
          ? { startAccumulation: true, escrowType: "OneToN" as const }
          : undefined,
      }}
    />
  )
}
