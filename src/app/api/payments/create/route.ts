import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { createPayment, calculateCommission, buildTransfers } from "@/lib/yookassa"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "ID товара не указан" },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, status: "ACTIVE" },
      include: {
        seller: { select: { id: true, name: true, yookassaAccountId: true } },
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

    // Сплитование возможно, только если продавец подключил свой счёт
    // в «ЮKassa для платформ». Иначе деньги приходят площадке и
    // распределяются через внутренний баланс.
    const splitAccountId = product.seller.yookassaAccountId || null

    // Create pending purchase
    const purchase = await prisma.purchase.create({
      data: {
        buyerId: session.user.id,
        productId,
        amount: product.price,
        commission,
        sellerEarnings,
        status: "PENDING",
        splitAccountId,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    // Шаг 1 сделки: деньги только замораживаются на карте покупателя
    // (capture: false). Списание произойдёт после подтверждения приёма.
    const payment = await createPayment({
      amount: product.price,
      description: `Покупка: ${product.title}`,
      returnUrl: `${baseUrl}/payment/success?purchaseId=${purchase.id}`,
      capture: false,
      idempotenceKey: `payment-${purchase.id}`,
      transfers: splitAccountId
        ? buildTransfers({
            accountId: splitAccountId,
            amount: product.price,
            commission,
          })
        : undefined,
      metadata: {
        purchaseId: purchase.id,
        productId: product.id,
        buyerId: session.user.id,
      },
    })

    // Update purchase with payment ID
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { yookassaPaymentId: payment.id },
    })

    return NextResponse.json({
      success: true,
      data: {
        purchaseId: purchase.id,
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
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
