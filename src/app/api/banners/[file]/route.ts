import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { BANNERS_DIR, BANNER_FILE_NAME } from "@/lib/banners"

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

/**
 * Картинка баннера с диска. Публичная: баннеры видит любой посетитель
 * главной. Браузер обычно получает её не отсюда, а сжатой из
 * `/_next/image`, который забирает оригинал этим же маршрутом.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params

  // Имя сверяем с шаблоном загрузки целиком: ни «..», ни слэшей, ни
  // чужих расширений — наружу уходит только то, что лежит в папке
  // баннеров, а не соседние приватные файлы товаров из uploads/.
  if (!BANNER_FILE_NAME.test(file)) {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const buffer = await readFile(path.join(BANNERS_DIR, file))

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[path.extname(file)],
        "Content-Length": buffer.length.toString(),
        // Каждая загрузка получает новое имя, содержимое по адресу
        // не меняется никогда — кэшировать можно навсегда.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
