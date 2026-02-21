import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getPayment } from "@/lib/yookassa"
import { v4 as uuidv4 } from "uuid"

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

    // If still pending and has YooKassa payment ID, check payment status
    if (purchase.status === "PENDING" && purchase.yookassaPaymentId) {
      try {
        const payment = await getPayment(purchase.yookassaPaymentId)

        if (payment.status === "succeeded") {
          // Payment succeeded but webhook hasn't processed yet
          const downloadToken = uuidv4()
          const downloadExpiresAt = new Date()
          downloadExpiresAt.setDate(downloadExpiresAt.getDate() + 30)

          // Get product details to check for license keys
          const product = await prisma.product.findUnique({
            where: { id: purchase.productId },
          })

          if (!product) {
            return NextResponse.json(
              { success: false, error: "Товар не найден" },
              { status: 404 }
            )
          }

          // Check if product uses license keys
          let licenseKey = null
          if (product.hasLicenseKeys) {
            // Find an available license key
            licenseKey = await prisma.licenseKey.findFirst({
              where: {
                productId: purchase.productId,
                isSold: false,
              },
            })

            if (!licenseKey) {
              console.error("No available license keys for product:", purchase.productId)
              // Mark purchase as failed if no keys available
              await prisma.purchase.update({
                where: { id: purchase.id },
                data: { status: "FAILED" },
              })
              return NextResponse.json(
                { success: false, error: "Нет доступных лицензионных ключей" },
                { status: 400 }
              )
            }
          }

          // Build transaction operations
          const updateOperations: any[] = [
            prisma.purchase.update({
              where: { id: purchase.id },
              data: {
                status: "COMPLETED",
                downloadToken,
                downloadExpiresAt,
                ...(licenseKey ? { licenseKeyId: licenseKey.id } : {}),
              },
            }),
            prisma.product.update({
              where: { id: purchase.productId },
              data: {
                downloadCount: { increment: 1 },
              },
            }),
            prisma.user.update({
              where: { id: product.sellerId },
              data: {
                balance: { increment: purchase.sellerEarnings },
              },
            }),
          ]

          // Mark license key as sold if applicable
          if (licenseKey) {
            updateOperations.push(
              prisma.licenseKey.update({
                where: { id: licenseKey.id },
                data: {
                  isSold: true,
                  soldAt: new Date(),
                },
              })
            )
          }

          await prisma.$transaction(updateOperations)

          return NextResponse.json({
            success: true,
            data: {
              status: "COMPLETED",
              product: purchase.product,
            },
          })
        }

        if (payment.status === "canceled") {
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: { status: "FAILED" },
          })

          return NextResponse.json({
            success: true,
            data: {
              status: "FAILED",
              product: purchase.product,
            },
          })
        }
      } catch (error) {
        console.error("Error checking payment status:", error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: purchase.status,
        product: purchase.product,
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
