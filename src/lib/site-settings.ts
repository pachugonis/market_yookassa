import { prisma } from "@/lib/prisma"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo"

export interface SiteSettings {
  siteName: string
  siteDescription: string
}

/**
 * Название и описание площадки из «Основных настроек» админки.
 *
 * Читаем на сервере, а не запросом из браузера: и то, и другое стоит в
 * метатегах и в шапке страницы, а подставленное после загрузки успевало
 * бы мигнуть старым значением.
 *
 * Ошибку базы глотаем намеренно. Настройки нужны при отрисовке
 * метатегов, а те собираются в том числе во время сборки образа, когда
 * DATABASE_URL — заглушка (см. Dockerfile). Упавший запрос там уронил
 * бы сборку целиком; значения по умолчанию из `seo.ts` — приемлемая
 * замена.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const settings = await prisma.platformSettings.findFirst({
      select: { siteName: true, siteDescription: true },
    })

    return {
      siteName: settings?.siteName?.trim() || SITE_NAME,
      siteDescription: settings?.siteDescription?.trim() || SITE_DESCRIPTION,
    }
  } catch {
    return { siteName: SITE_NAME, siteDescription: SITE_DESCRIPTION }
  }
}

/** Только название — там, где описание не нужно. */
export async function getSiteName(): Promise<string> {
  return (await getSiteSettings()).siteName
}

/**
 * Заголовок страницы вида «Название — маркетплейс цифровых товаров».
 * Одна формулировка на title, og:title и twitter:title.
 */
export function siteTitle(siteName: string): string {
  return `${siteName} — ${SITE_TAGLINE}`
}
