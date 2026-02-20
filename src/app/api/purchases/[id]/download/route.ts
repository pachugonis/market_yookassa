import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const token = request.nextUrl.searchParams.get("token")

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            sellerId: true,
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: "Покупка не найдена" },
        { status: 404 }
      )
    }

    // Verify ownership
    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Нет доступа к этой покупке" },
        { status: 403 }
      )
    }

    // Verify purchase status
    if (purchase.status !== "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Платеж не завершен" },
        { status: 400 }
      )
    }

    // Verify token
    if (purchase.downloadToken !== token) {
      return NextResponse.json(
        { success: false, error: "Неверный токен загрузки" },
        { status: 403 }
      )
    }

    // Check expiration
    if (purchase.downloadExpiresAt && new Date() > purchase.downloadExpiresAt) {
      return NextResponse.json(
        { success: false, error: "Срок действия загрузки истек" },
        { status: 403 }
      )
    }

    // Get file path
    const filePath = path.join(
      process.cwd(),
      "uploads",
      purchase.product.fileUrl
    )

    try {
      const fileBuffer = await readFile(filePath)

      // Log download
      await prisma.$transaction([
        prisma.downloadLog.create({
          data: {
            purchaseId: purchase.id,
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
            userAgent: request.headers.get("user-agent"),
          },
        }),
        prisma.purchase.update({
          where: { id: purchase.id },
          data: {
            downloadCount: { increment: 1 },
          },
        }),
      ])

      // Return file
      const response = new NextResponse(fileBuffer)
      response.headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(purchase.product.fileName)}"`
      )
      response.headers.set("Content-Type", "application/octet-stream")
      response.headers.set("Content-Length", fileBuffer.length.toString())
      response.headers.set("Cache-Control", "no-store")

      return response
    } catch {
      console.error("File not found:", filePath)
      return NextResponse.json(
        { success: false, error: "Файл не найден" },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при скачивании" },
      { status: 500 }
    )
  }
}
