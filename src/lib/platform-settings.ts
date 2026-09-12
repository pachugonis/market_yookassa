import { cache } from "react"
import type { HomePageVariant } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Настройки площадки живут в единственной строке `PlatformSettings`, но
 * нужны в разных местах одного и того же рендера: название — в метатегах
 * корневого layout, витрина продавцов — в шапке, вариант главной — на
 * самой странице. Раньше каждый вопрос к настройкам был отдельным
 * `findFirst`, и один переход по сайту стоил четырёх-пяти запросов к
 * одной и той же строке.
 *
 * Поэтому строку читаем целиком и ровно один раз за запрос.
 */
const SETTINGS_SELECT = {
  siteName: true,
  siteDescription: true,
  singleVendorMode: true,
  storesPageEnabled: true,
  homePage: true,
  maintenanceMode: true,
} as const

export interface PlatformSettingsRow {
  siteName: string
  siteDescription: string
  singleVendorMode: boolean
  storesPageEnabled: boolean
  homePage: HomePageVariant
  maintenanceMode: boolean
}

/**
 * Чтение без памяти о предыдущих вызовах — для `proxy.ts`, который живёт
 * вне рендера React, и там `cache()` бесполезен.
 *
 * Ошибку базы глотаем намеренно: настройки читаются в том числе во время
 * сборки образа, когда DATABASE_URL — заглушка (см. Dockerfile). Упавший
 * запрос уронил бы сборку целиком, а у каждого вызывающего есть
 * осмысленное значение по умолчанию на случай `null`.
 */
export async function readPlatformSettings(): Promise<PlatformSettingsRow | null> {
  try {
    return await prisma.platformSettings.findFirst({ select: SETTINGS_SELECT })
  } catch {
    return null
  }
}

/**
 * Те же настройки для серверных компонентов и маршрутов.
 *
 * `cache()` из React держит результат в пределах одного запроса: сколько
 * бы мест ни спросило настройки при отрисовке страницы, база ответит один
 * раз. Между запросами не кэшируется ничего, поэтому сохранённые в
 * админке настройки видны сразу же, без задержки на протухание.
 */
export const getPlatformSettings = cache(readPlatformSettings)
