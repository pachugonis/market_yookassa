import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { CategoryNav } from "@/components/layout/category-nav"
import { SiteSettingsProvider } from "@/components/layout/site-settings-provider"
import { isStoresPageEnabled } from "@/lib/platform-mode"
import { getSiteSettings } from "@/lib/site-settings"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const storesPageEnabled = await isStoresPageEnabled()
  const siteSettings = await getSiteSettings()
  const categories = await prisma.category.findMany({
    where: { parentId: null, isHidden: false },
    orderBy: { name: "asc" },
    include: {
      subcategories: {
        where: { isHidden: false },
        orderBy: { name: "asc" },
      },
    },
  })

  return (
    <SiteSettingsProvider value={siteSettings}>
      <div className="min-h-screen flex flex-col">
        <Navbar storesPageEnabled={storesPageEnabled} />
        <CategoryNav categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categorySlugs={categories.map((category) => category.slug)} />
      </div>
    </SiteSettingsProvider>
  )
}
