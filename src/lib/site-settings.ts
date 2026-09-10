import { prisma } from "@/lib/prisma"
import { SITE_NAME } from "@/lib/seo"

/**
 * Название площадки из «Основных настроек» админки.
 *
 * Читаем на сервере, а не запросом из браузера: название стоит в шапке
 * страницы, и подставленное после загрузки оно успевало бы мигнуть
 * старым значением. Пока настроек в базе нет (или поле пустое),
 * остаётся значение по умолчанию из `seo.ts` — то же, что видят
 * метатеги.
 */
export async function getSiteName(): Promise<string> {
  const settings = await prisma.platformSettings.findFirst({
    select: { siteName: true },
  })

  return settings?.siteName?.trim() || SITE_NAME
}
