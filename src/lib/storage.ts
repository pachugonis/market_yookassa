import path from "path"

/** Корень хранилища приватных файлов товаров. */
export const UPLOADS_ROOT = path.join(process.cwd(), "uploads")

/**
 * Разрешённые типы изображений для файлов, которые попадают в public/
 * и отдаются статикой. Расширение берём ОТСЮДА, а не из имени файла,
 * которое полностью контролируется клиентом.
 */
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

/** SVG отдельно: может содержать <script>, поэтому доступен не везде. */
const SVG_TYPE = "image/svg+xml"

export interface ImageValidationResult {
  ok: boolean
  extension?: string
  error?: string
}

/**
 * Проверяет сигнатуру (magic bytes) буфера и возвращает безопасное
 * расширение. Заявленный клиентом Content-Type не является
 * доказательством — используем его только чтобы отсечь заведомо
 * неподходящие файлы, а решение принимаем по содержимому.
 */
export function validateImageBuffer(
  buffer: Buffer,
  declaredType: string,
  { allowSvg = false }: { allowSvg?: boolean } = {}
): ImageValidationResult {
  const allowed = allowSvg
    ? { ...IMAGE_TYPES, [SVG_TYPE]: ".svg" }
    : IMAGE_TYPES

  if (!allowed[declaredType]) {
    return {
      ok: false,
      error: `Недопустимый тип файла. Разрешены: ${Object.keys(allowed).join(", ")}`,
    }
  }

  const sniffed = sniffImageType(buffer, allowSvg)

  if (!sniffed) {
    return {
      ok: false,
      error: "Содержимое файла не является допустимым изображением",
    }
  }

  // Клиент не должен иметь возможности выдать PNG за SVG и наоборот
  if (sniffed !== declaredType) {
    return {
      ok: false,
      error: "Содержимое файла не соответствует заявленному типу",
    }
  }

  return { ok: true, extension: allowed[sniffed] }
}

/** Определяет тип изображения по сигнатуре содержимого. */
function sniffImageType(buffer: Buffer, allowSvg: boolean): string | null {
  if (buffer.length < 12) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png"
  }

  // GIF: "GIF87a" / "GIF89a"
  if (buffer.subarray(0, 6).toString("latin1").match(/^GIF8[79]a$/)) {
    return "image/gif"
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp"
  }

  if (allowSvg) {
    // SVG — текстовый формат; ищем корневой тег в начале файла
    const head = buffer.subarray(0, 1024).toString("utf8").trimStart()
    if (head.startsWith("<?xml") || head.startsWith("<svg")) {
      if (/<svg[\s>]/i.test(head)) return SVG_TYPE
    }
  }

  return null
}

/**
 * SVG может нести активный контент. Отклоняем файлы со скриптами,
 * обработчиками событий и внешними ссылками.
 */
export function svgContainsActiveContent(buffer: Buffer): boolean {
  const text = buffer.toString("utf8")
  return (
    /<script[\s>]/i.test(text) ||
    /\son\w+\s*=/i.test(text) ||
    /javascript:/i.test(text) ||
    /<foreignObject[\s>]/i.test(text) ||
    /<!ENTITY/i.test(text)
  )
}

/**
 * Формат fileUrl, который генерирует /api/upload: `<sellerId>/<uuid><ext>`.
 * Оба сегмента без точек и слэшей, расширение — ограниченный набор
 * символов. Любое значение вне этого шаблона отклоняем.
 */
const PRODUCT_FILE_URL = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}(\.[A-Za-z0-9]{1,16})?$/

/** Путь к обложке, который выдаёт /api/upload: /covers/<uuid>.<ext> */
export const COVER_IMAGE_PATTERN =
  /^\/covers\/[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9]{1,16}$/

export function isValidProductFileUrl(fileUrl: string): boolean {
  if (!PRODUCT_FILE_URL.test(fileUrl)) return false
  // Дополнительная страховка от «..» и абсолютных путей
  if (fileUrl.includes("..") || path.isAbsolute(fileUrl)) return false
  return true
}

/**
 * Превращает относительный fileUrl в абсолютный путь и гарантирует,
 * что результат не выходит за пределы UPLOADS_ROOT. Возвращает null,
 * если путь небезопасен.
 */
export function resolveUploadPath(fileUrl: string): string | null {
  if (typeof fileUrl !== "string" || fileUrl.length === 0) return null

  const absolute = path.resolve(UPLOADS_ROOT, fileUrl)
  const root = path.resolve(UPLOADS_ROOT)

  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    return null
  }

  return absolute
}

/** Безопасное имя файла для заголовка Content-Disposition. */
export function sanitizeFileName(fileName: string): string {
  return (
    path
      .basename(fileName)
      .replace(/[\r\n"\\]/g, "")
      .slice(0, 200) || "download"
  )
}
