import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { validateImageBuffer } from "@/lib/storage"

/**
 * Расширение файла товара. Сам файл наружу статикой не отдаётся
 * (только через /api/purchases/[id]/download), но подставляется
 * в путь на диске, поэтому оставляем лишь безопасные символы.
 */
function safeExtension(fileName: string): string {
  const ext = path.extname(path.basename(fileName)).toLowerCase()
  return /^\.[a-z0-9]{1,16}$/.test(ext) ? ext : ""
}

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

    let uploadDir: string
    let uniqueName: string
    let fileUrl: string

    if (type === "cover") {
      // Обложка попадает в public/ и отдаётся веб-сервером напрямую,
      // поэтому расширение берём из проверенного содержимого:
      // иначе можно было бы залить .html и получить XSS на домене.
      const validation = validateImageBuffer(buffer, file.type)

      if (!validation.ok) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        )
      }

      uniqueName = `${uuidv4()}${validation.extension}`
      uploadDir = path.join(process.cwd(), "public", "covers")
      fileUrl = `/covers/${uniqueName}`
    } else {
      uniqueName = `${uuidv4()}${safeExtension(file.name)}`
      uploadDir = path.join(process.cwd(), "uploads", session.user.id)
      fileUrl = `${session.user.id}/${uniqueName}`
    }

    await mkdir(uploadDir, { recursive: true })
    // Путь известен только во время запроса; без подсказки Turbopack
    // трассирует весь проект и при каждой сборке копирует uploads/ и
    // public/ в .next/standalone.
    await writeFile(path.join(/*turbopackIgnore: true*/ uploadDir, uniqueName), buffer)

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
