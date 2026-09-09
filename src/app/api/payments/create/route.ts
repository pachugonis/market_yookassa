import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { calculateCommission } from "@/lib/yookassa"
import { getGateway, resolveProvider, splitAccountFor } from "@/lib/payments"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const { productId, provider: requestedProvider } = await request.json()

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "ID товара не указан" },
        { status: 400 }
      )
    }

    // Выбор покупателя учитывается, только если такой сервис настроен.
    const provider = resolveProvider(requestedProvider)

    if (!provider) {
      console.error("Ни один платёжный сервис не настроен")
      return NextResponse.json(
        { success: false, error: "Оплата временно недоступна" },
        { status: 503 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, status: "ACTIVE" },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            yookassaAccountId: true,
            cloudpaymentsPayoutToken: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Товар не найден" },
        { status: 404 }
      )
    }

    if (product.sellerId === session.user.id) {
      return NextResponse.json(
        { success: false, error: "Нельзя купить свой товар" },
        { status: 400 }
      )
    }

    // Товар уже куплен, либо по нему висит незавершённая сделка
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        buyerId: session.user.id,
        productId,
        status: { in: ["COMPLETED", "HELD"] },
      },
    })

    if (existingPurchase) {
      return NextResponse.json(
        { success: false, error: "Вы уже приобрели этот товар" },
        { status: 400 }
      )
    }

    const settings = await prisma.platformSettings.findFirst({
      select: { commissionRate: true },
    })

    const { commission, sellerEarnings } = calculateCommission(
      product.price,
      settings?.commissionRate
    )

    // Сплитование возможно, только если продавец подключил счёт именно
    // у этого провайдера. Иначе деньги приходят площадке и
    // распределяются через внутренний баланс.
    const splitAccountId = splitAccountFor(provider, product.seller)

    // Create pending purchase
    const purchase = await prisma.purchase.create({
      data: {
        buyerId: session.user.id,
        productId,
        amount: product.price,
        commission,
        sellerEarnings,
        status: "PENDING",
        paymentProvider: provider,
        splitAccountId,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    // Шаг 1 сделки: деньги только замораживаются на карте покупателя.
    // Списание произойдёт после подтверждения приёма.
    const hold = await getGateway(provider).createHold({
      purchaseId: purchase.id,
      productId: product.id,
      buyerId: session.user.id,
      amount: product.price,
      commission,
      description: `Покупка: ${product.title}`,
      returnUrl: `${baseUrl}/payment/success?purchaseId=${purchase.id}`,
      splitAccountId,
    })

    // Идентификатор платежа известен не у всех провайдеров сразу:
    // у CloudPayments транзакция появляется только после оплаты.
    if (hold.paymentId) {
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { providerPaymentId: hold.paymentId },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        purchaseId: purchase.id,
        provider,
        paymentId: hold.paymentId,
        confirmationUrl: hold.confirmationUrl,
      },
    })
  } catch (error) {
    console.error("Error creating payment:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при создании платежа" },
      { status: 500 }
    )
  }
}
