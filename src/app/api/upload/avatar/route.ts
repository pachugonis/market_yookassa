import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { auth } from "@/lib/auth"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { validateImageBuffer } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
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

    // Validate file size (max 5MB for avatars)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Файл слишком большой (максимум 5MB)" },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Аватар отдаётся статикой из public/, поэтому и тип, и расширение
    // определяем по содержимому: заголовок Content-Type и имя файла
    // задаёт клиент, доверять им нельзя.
    const validation = validateImageBuffer(buffer, file.type)

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    const uniqueName = `${uuidv4()}${validation.extension}`

    const uploadDir = path.join(process.cwd(), "public", "avatars")
    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, uniqueName)
    await writeFile(filePath, buffer)

    const avatarUrl = `/avatars/${uniqueName}`

    return NextResponse.json({
      success: true,
      data: {
        avatarUrl,
        fileName: file.name,
        fileSize: file.size,
      },
    })
  } catch (error) {
    console.error("Error uploading avatar:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке аватара" },
      { status: 500 }
    )
  }
}
