import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getPayment } from "@/lib/yookassa"
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
        product: { select: { title: true, coverImage: true } },
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
    // Спрашиваем ЮKassa напрямую и переводим сделку тем же атомарным
    // путём — двойной выдачи не произойдёт, даже если вебхук отработает
    // одновременно.
    if (purchase.status === "PENDING" && purchase.yookassaPaymentId) {
      try {
        const payment = await getPayment(purchase.yookassaPaymentId)

        if (
          payment.metadata?.purchaseId === purchase.id &&
          Number(payment.amount.value) <= purchase.amount
        ) {
          const outcome = await syncPurchaseWithPayment(purchase.id, payment)

          if (outcome.result === "no_license_keys") {
            return NextResponse.json(
              { success: false, error: "Нет доступных лицензионных ключей" },
              { status: 400 }
            )
          }
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
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        status: fresh?.status ?? purchase.status,
        product: purchase.product,
        heldAt: fresh?.heldAt ?? null,
        holdExpiresAt: fresh?.holdExpiresAt ?? null,
        autoConfirmAt: fresh?.autoConfirmAt ?? null,
        confirmedAt: fresh?.confirmedAt ?? null,
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
