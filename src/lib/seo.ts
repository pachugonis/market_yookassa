/**
 * Общие данные для метатегов, sitemap и микроразметки.
 *
 * Канонический адрес берём из NEXT_PUBLIC_BASE_URL. В проде он обязан быть
 * абсолютным https-адресом: на него опираются canonical, Open Graph и sitemap,
 * а относительные ссылки в этих местах поисковики игнорируют.
 */

export const SITE_NAME = "Amazonus"

export const SITE_DESCRIPTION =
  "Маркетплейс цифровых товаров: программы, игры, музыка, графика, шаблоны и электронные книги. Безопасная оплата и мгновенная доставка."

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim()

  if (!raw) {
    return "http://localhost:3000"
  }

  // Лишний слэш на конце ломает склейку путей в absoluteUrl.
  return raw.replace(/\/+$/, "")
}

export const SITE_URL = resolveSiteUrl()

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString()
}

/**
 * Google показывает в сниппете ~160 символов. Режем по границе слова,
 * чтобы описание не обрывалось на середине.
 */
export function truncateForMeta(text: string, limit = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim()

  if (normalized.length <= limit) {
    return normalized
  }

  const cut = normalized.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
