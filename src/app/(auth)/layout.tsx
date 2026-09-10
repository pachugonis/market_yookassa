import { SiteSettingsProvider } from "@/components/layout/site-settings-provider"
import { getSiteSettings } from "@/lib/site-settings"

// Название площадки меняется в админке — страницы входа и регистрации
// должны показывать текущее, а не то, что было на момент сборки.
export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const siteSettings = await getSiteSettings()

  return (
    <SiteSettingsProvider value={siteSettings}>{children}</SiteSettingsProvider>
  )
}
