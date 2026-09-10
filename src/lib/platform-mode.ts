import { prisma } from "@/lib/prisma"

/**
 * Режим площадки одного продавца.
 *
 * Включённый режим означает три вещи одновременно, и разделять их
 * нельзя: закрытая регистрация продавцов без запрета на создание
 * товаров оставила бы лазейку существующим аккаунтам, а запрет товаров
 * без отключённого сплитования — сделки, деньги по которым уходят на
 * чужой счёт у провайдера.
 *
 * Проверка живёт отдельно от `PlatformSettings`, потому что нужна и в
 * платежах, и в регистрации, и в каталоге: одна формулировка на всех
 * дешевле, чем три места, где условие можно записать по-разному.
 */
export async function isSingleVendorMode(): Promise<boolean> {
  const settings = await prisma.platformSettings.findFirst({
    select: { singleVendorMode: true },
  })

  return settings?.singleVendorMode ?? false
}

/**
 * Показывать ли витрину продавцов `/stores`.
 *
 * Выключенная витрина означает и отсутствие страницы (404), и
 * отсутствие пункта в меню, и отсутствие адреса в sitemap: ссылка,
 * ведущая на 404, хуже отсутствующей ссылки.
 *
 * Пока настроек в базе нет, витрина считается включённой — это
 * поведение площадки до появления выключателя.
 */
export async function isStoresPageEnabled(): Promise<boolean> {
  const settings = await prisma.platformSettings.findFirst({
    select: { storesPageEnabled: true },
  })

  return settings?.storesPageEnabled ?? true
}
