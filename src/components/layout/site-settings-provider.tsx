"use client"

import { createContext, useContext, type ReactNode } from "react"
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo"
import type { SiteSettings } from "@/lib/site-settings"

/**
 * Название и описание площадки для клиентских частей интерфейса.
 *
 * Значение приходит из серверного layout'а, поэтому страница с формой
 * или шапка сайта могут оставаться клиентскими (состояние, обработчики)
 * и всё равно отрисовать название сразу, без отдельного запроса к
 * `/api/settings`.
 */
const SiteSettingsContext = createContext<SiteSettings>({
  siteName: SITE_NAME,
  siteDescription: SITE_DESCRIPTION,
})

export function SiteSettingsProvider({
  value,
  children,
}: {
  value: SiteSettings
  children: ReactNode
}) {
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteName(): string {
  return useContext(SiteSettingsContext).siteName
}

export function useSiteDescription(): string {
  return useContext(SiteSettingsContext).siteDescription
}
