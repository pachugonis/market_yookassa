import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getGateway } from "@/lib/payments"
import { syncPurchaseWithPayment } from "@/lib/purchase-fulfillment"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const purchaseId = request.nextUrl.searchParams.get("purchaseId")

    if (!purchaseId) {
      return NextResponse.json(
        { success: false, error: "ID покупки не указан" },
        { status: 400 }
      )
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        product: { select: { id: true, title: true, coverImage: true } },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: "Покупка не найдена" },
        { status: 404 }
      )
    }

    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Нет доступа к этой покупке" },
        { status: 403 }
      )
    }

    // Покупатель мог вернуться со страницы оплаты раньше вебхука.
    // Спрашиваем провайдера напрямую и переводим сделку тем же атомарным
    // путём — двойной выдачи не произойдёт, даже если вебхук отработает
    // одновременно.
    //
    // Возврат со страницы оплаты бывает и без оплаты — покупатель её
    // отменил. Провайдер тогда держит платёж в ожидании, и проверять
    // дальше нечего: ждать можно только у платежа, по которому деньги
    // уже отправлены (биткоин, ждущий подтверждений сети).
    let awaitingPayment = false

    if (purchase.status === "PENDING") {
      try {
        const gateway = getGateway(purchase.paymentProvider)

        // У CloudPayments номер транзакции появляется только после
        // оплаты, поэтому платёж ищется по номеру заказа.
        const payment = purchase.providerPaymentId
          ? await gateway.getPayment(purchase.providerPaymentId)
          : await gateway.findPaymentByPurchase(purchase.id)

        if (
          payment &&
          payment.purchaseId === purchase.id &&
          payment.amount <= purchase.amount
        ) {
          const outcome = await syncPurchaseWithPayment(purchase.id, payment)

          if (outcome.result === "no_license_keys") {
            return NextResponse.json(
              { success: false, error: "Нет доступных лицензионных ключей" },
              { status: 400 }
            )
          }

          awaitingPayment =
            payment.status === "pending" && !(payment.amountSats && payment.amountSats > 0)
        }
      } catch (error) {
        console.error("Error checking payment status:", error)
      }
    }

    const fresh = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      select: {
        status: true,
        amount: true,
        heldAt: true,
        holdExpiresAt: true,
        autoConfirmAt: true,
        confirmedAt: true,
        instantCapture: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        status: fresh?.status ?? purchase.status,
        // Покупатель вернулся, не заплатив, — страница оплаты не ждёт.
        awaitingPayment: awaitingPayment && fresh?.status === "PENDING",
        product: purchase.product,
        // Оплата биткоином ждёт подтверждения сети — покупателю нужно
        // объяснить, почему страница не отвечает сразу.
        paymentProvider: purchase.paymentProvider,
        heldAt: fresh?.heldAt ?? null,
        holdExpiresAt: fresh?.holdExpiresAt ?? null,
        autoConfirmAt: fresh?.autoConfirmAt ?? null,
        confirmedAt: fresh?.confirmedAt ?? null,
        // Списано сразу — значит, покупателю нужно рассказать не про
        // подтверждение приёма, а про срок, пока можно открыть спор.
        instantCapture: fresh?.instantCapture ?? purchase.instantCapture,
      },
    })
  } catch (error) {
    console.error("Error getting payment status:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при проверке статуса" },
      { status: 500 }
    )
  }
}
