import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"

interface YooKassaWebhookEvent {
  type: string
  event: string
  object: {
    id: string
    status: string
    amount: {
      value: string
      currency: string
    }
    metadata?: {
      purchaseId?: string
      productId?: string
      buyerId?: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const event: YooKassaWebhookEvent = JSON.parse(body)

    console.log("YooKassa webhook received:", event.event, event.object.id)

    if (event.event === "payment.succeeded") {
      const { id: paymentId, metadata } = event.object

      if (!metadata?.purchaseId) {
        console.error("No purchaseId in metadata")
        return NextResponse.json({ success: true })
      }

      const purchase = await prisma.purchase.findUnique({
        where: { id: metadata.purchaseId },
        include: { product: true },
      })

      if (!purchase) {
        console.error("Purchase not found:", metadata.purchaseId)
        return NextResponse.json({ success: true })
      }

      if (purchase.status === "COMPLETED") {
        console.log("Purchase already completed:", purchase.id)
        return NextResponse.json({ success: true })
      }

      // Check if product uses license keys
      let licenseKey = null
      if (purchase.product.hasLicenseKeys) {
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
          return NextResponse.json({ success: true })
        }
      }

      // Generate download token
      const downloadToken = uuidv4()
      const downloadExpiresAt = new Date()
      downloadExpiresAt.setDate(downloadExpiresAt.getDate() + 30) // 30 days

      // Update purchase and product
      const updateOperations: any[] = [
        prisma.purchase.update({
          where: { id: purchase.id },
          data: {
            status: "COMPLETED",
            yookassaPaymentId: paymentId,
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
          where: { id: purchase.product.sellerId },
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

      console.log("Payment processed successfully:", purchase.id)
    }

    if (event.event === "payment.canceled") {
      const { metadata } = event.object

      if (metadata?.purchaseId) {
        await prisma.purchase.update({
          where: { id: metadata.purchaseId },
          data: { status: "FAILED" },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ success: true }) // Always return 200 to YooKassa
  }
}
