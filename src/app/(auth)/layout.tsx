import { SiteNameProvider } from "@/components/layout/site-name-provider"
import { getSiteName } from "@/lib/site-settings"

// Название площадки меняется в админке — страницы входа и регистрации
// должны показывать текущее, а не то, что было на момент сборки.
export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const siteName = await getSiteName()

  return <SiteNameProvider value={siteName}>{children}</SiteNameProvider>
}
