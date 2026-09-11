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
 * Может ли пользователь заводить и править товары.
 *
 * В режиме одного продавца витриной распоряжается только
 * администратор. Сам раздел «Товары» при этом остаётся открытым: у
 * продавца там его прежние карточки, и убрать их с витрины он должен
 * мочь без администратора. Закрыты создание и правка.
 */
export async function canManageProducts(
  role: string | null | undefined
): Promise<boolean> {
  return role === "ADMIN" || !(await isSingleVendorMode())
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

/**
 * Показывать ли по адресу «/» каталог товаров вместо витрины-лендинга.
 *
 * Каталог именно рисуется на главной, а не открывается редиректом на
 * «/products»: главная площадки должна оставаться по короткому адресу —
 * он стоит в ссылках, письмах и метатегах.
 *
 * Адрес «/products» при этом продолжает работать: на него ведут меню,
 * поиск в шапке и внешние ссылки. Чтобы поисковик не считал две
 * одинаковые страницы разными, канонический адрес каталога в этом
 * режиме — «/» (см. `products/page.tsx` и `sitemap.ts`).
 *
 * Пока настроек в базе нет, главная остаётся лендингом — это поведение
 * площадки до появления переключателя.
 */
export async function isCatalogHomePage(): Promise<boolean> {
  const settings = await prisma.platformSettings.findFirst({
    select: { homePage: true },
  })

  return settings?.homePage === "CATALOG"
}
