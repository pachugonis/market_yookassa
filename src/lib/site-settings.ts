import { prisma } from "@/lib/prisma"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo"

/**
 * Название площадки из «Основных настроек» админки.
 *
 * Читаем на сервере, а не запросом из браузера: название стоит в шапке
 * страницы и в метатегах, и подставленное после загрузки оно успевало
 * бы мигнуть старым значением.
 *
 * Ошибку базы глотаем намеренно. Название нужно и при отрисовке
 * метатегов, а те собираются в том числе во время сборки образа, когда
 * DATABASE_URL — заглушка (см. Dockerfile). Упавший запрос там уронил
 * бы сборку целиком; значение по умолчанию из `seo.ts` для заголовка
 * страницы — приемлемая замена.
 */
export async function getSiteName(): Promise<string> {
  try {
    const settings = await prisma.platformSettings.findFirst({
      select: { siteName: true },
    })

    return settings?.siteName?.trim() || SITE_NAME
  } catch {
    return SITE_NAME
  }
}

/**
 * Заголовок страницы вида «Название — маркетплейс цифровых товаров».
 * Одна формулировка на title, og:title и twitter:title.
 */
export function siteTitle(siteName: string): string {
  return `${siteName} — ${SITE_TAGLINE}`
}
