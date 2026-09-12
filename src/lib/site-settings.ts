import { getPlatformSettings } from "@/lib/platform-settings"
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
 * Строку настроек читает `platform-settings.ts` — один запрос на весь
 * рендер, общий с остальными вопросами к настройкам. Недоступная база
 * там оборачивается в `null`, и значения по умолчанию из `seo.ts` —
 * приемлемая замена.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = await getPlatformSettings()

  return {
    siteName: settings?.siteName?.trim() || SITE_NAME,
    siteDescription: settings?.siteDescription?.trim() || SITE_DESCRIPTION,
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
