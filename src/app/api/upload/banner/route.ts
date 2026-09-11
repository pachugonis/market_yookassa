import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { validateImageBuffer } from "@/lib/storage"
import { BANNERS_DIR, bannerImageUrl } from "@/lib/banners"

// Баннер во всю ширину страницы на ретина-экране весит заметно больше
// иконки, но картинка тяжелее этого — уже вопрос к её сжатию, а не к
// лимиту: главная грузит её первой.
const MAX_FILE_SIZE = 5 * 1024 * 1024

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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Файл слишком большой (максимум 5MB)" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // SVG не принимаем: баннер — это картинка, а не документ, и
    // активному содержимому на главной делать нечего.
    const validation = validateImageBuffer(buffer, file.type)

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    const uniqueName = `${uuidv4()}${validation.extension}`

    await mkdir(BANNERS_DIR, { recursive: true })
    await writeFile(path.join(BANNERS_DIR, uniqueName), buffer)

    return NextResponse.json({
      success: true,
      data: { imageUrl: bannerImageUrl(uniqueName) },
    })
  } catch (error) {
    console.error("Error uploading banner image:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке картинки" },
      { status: 500 }
    )
  }
}
