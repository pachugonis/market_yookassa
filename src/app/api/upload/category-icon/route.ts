import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { validateImageBuffer, svgContainsActiveContent } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен. Требуются права администратора" },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Файл не предоставлен" },
        { status: 400 }
      )
    }

    // Validate file size (max 2MB for icons)
    const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Файл слишком большой (максимум 2MB)" },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Иконка отдаётся статикой — расширение определяем по содержимому
    const validation = validateImageBuffer(buffer, file.type, { allowSvg: true })

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // SVG исполняется браузером как документ: скрипты и обработчики
    // событий внутри дали бы XSS на основном домене.
    if (validation.extension === ".svg" && svgContainsActiveContent(buffer)) {
      return NextResponse.json(
        { success: false, error: "SVG содержит скрипты или внешние ссылки и был отклонён" },
        { status: 400 }
      )
    }

    const uniqueName = `${uuidv4()}${validation.extension}`

    const uploadDir = path.join(process.cwd(), "public", "category-icons")
    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, uniqueName)
    await writeFile(filePath, buffer)

    const iconUrl = `/category-icons/${uniqueName}`

    return NextResponse.json({
      success: true,
      data: {
        iconUrl,
        fileName: file.name,
        fileSize: file.size,
      },
    })
  } catch (error) {
    console.error("Error uploading category icon:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке иконки" },
      { status: 500 }
    )
  }
}
