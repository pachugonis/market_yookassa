"use client"

import { createContext, useContext } from "react"

/**
 * Что продавцу доступно в его кабинете при текущих настройках площадки.
 *
 * Считается на сервере, в layout кабинета: клиентским страницам режим
 * площадки взять больше неоткуда, а спрашивать его каждой страницей
 * отдельно — три запроса вместо одного и три разных момента, когда
 * кнопка успевает мелькнуть.
 */
export interface SellerCapabilities {
  /** Можно ли выставлять и править товары. */
  canManageProducts: boolean
}

const SellerCapabilitiesContext = createContext<SellerCapabilities>({
  canManageProducts: true,
})

export function SellerCapabilitiesProvider({
  value,
  children,
}: {
  value: SellerCapabilities
  children: React.ReactNode
}) {
  return (
    <SellerCapabilitiesContext.Provider value={value}>
      {children}
    </SellerCapabilitiesContext.Provider>
  )
}

export function useSellerCapabilities(): SellerCapabilities {
  return useContext(SellerCapabilitiesContext)
}
