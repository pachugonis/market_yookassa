import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Только продавцы могут загружать файлы" },
        { status: 403 }
      )
    }

    // Get max file size from settings
    let settings = await prisma.platformSettings.findFirst()
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          commissionRate: 10,
          minPayoutAmount: 100000,
          maxFileSize: 500,
          notifyNewUser: true,
          notifyNewProduct: true,
          notifyNewPurchase: true,
          notifyPayoutRequest: true,
          notifyReportSubmission: false,
          requireEmailVerification: false,
          enableTwoFactor: false,
          sessionTimeout: 24,
          maxLoginAttempts: 5,
        },
      })
    }

    const MAX_FILE_SIZE = settings.maxFileSize * 1024 * 1024 // Convert MB to bytes

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string | null // "product" or "cover"

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Файл не предоставлен" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Файл слишком большой (максимум ${settings.maxFileSize}MB)` },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = path.extname(file.name)
    const uniqueName = `${uuidv4()}${ext}`
    
    const uploadDir = type === "cover" 
      ? path.join(process.cwd(), "public", "covers")
      : path.join(process.cwd(), "uploads", session.user.id)

    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, uniqueName)
    await writeFile(filePath, buffer)

    const fileUrl = type === "cover"
      ? `/covers/${uniqueName}`
      : `${session.user.id}/${uniqueName}`

    return NextResponse.json({
      success: true,
      data: {
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
      },
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке файла" },
      { status: 500 }
    )
  }
}
