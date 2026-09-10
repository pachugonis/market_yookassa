"use client"

import { createContext, useContext, type ReactNode } from "react"
import { SITE_NAME } from "@/lib/seo"

/**
 * Название площадки для клиентских страниц.
 *
 * Значение приходит из серверного layout'а, поэтому страница с формой
 * может оставаться клиентской (состояние, обработчики) и всё равно
 * отрисовать название сразу, без отдельного запроса к `/api/settings`.
 */
const SiteNameContext = createContext(SITE_NAME)

export function SiteNameProvider({
  value,
  children,
}: {
  value: string
  children: ReactNode
}) {
  return (
    <SiteNameContext.Provider value={value}>{children}</SiteNameContext.Provider>
  )
}

export function useSiteName(): string {
  return useContext(SiteNameContext)
}
