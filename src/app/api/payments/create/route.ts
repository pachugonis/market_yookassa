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
      select: { commissionRate: true, singleVendorMode: true },
    })

    const { commission, sellerEarnings } = calculateCommission(
      product.price,
      settings?.commissionRate
    )

    // Сплитование возможно, только если продавец подключил счёт именно
    // у этого провайдера. Иначе деньги приходят площадке и
    // распределяются через внутренний баланс.
    //
    // В режиме одного продавца сплитования нет вовсе: вся сумма
    // приходит на счёт площадки. Реквизиты, оставшиеся у продавцов с
    // прежних времён, при этом игнорируются — решает режим, а не
    // содержимое чужого профиля.
    const splitAccountId = settings?.singleVendorMode
      ? null
      : splitAccountFor(provider, product.seller)

    // В режиме одного продавца деньги списываются сразу: продавец здесь
    // и есть площадка, ждать от покупателя подтверждения приёма незачем.
    // Защитой остаётся спор — его можно открыть в течение суток
    // (`DISPUTE_WINDOW_HOURS`), а возврат делает та же площадка со
    // своего счёта. Там, где продавцы приходят со стороны и сделка
    // сплитуется, схема прежняя: холд до подтверждения приёма.
    const instantCapture = Boolean(settings?.singleVendorMode)

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
        instantCapture,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    // Шаг 1 сделки: деньги только замораживаются на карте покупателя.
    // Списание произойдёт после подтверждения приёма — а при
    // `instantCapture` сразу же, как провайдер сообщит о заморозке.
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
