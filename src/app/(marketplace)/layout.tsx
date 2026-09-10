import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { CategoryNav } from "@/components/layout/category-nav"
import { SiteNameProvider } from "@/components/layout/site-name-provider"
import { isStoresPageEnabled } from "@/lib/platform-mode"
import { getSiteName } from "@/lib/site-settings"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const storesPageEnabled = await isStoresPageEnabled()
  const siteName = await getSiteName()
  const categories = await prisma.category.findMany({
    where: { parentId: null } as any,
    orderBy: { name: "asc" },
    include: {
      subcategories: {
        orderBy: { name: "asc" },
      },
    } as any,
  })

  return (
    <SiteNameProvider value={siteName}>
      <div className="min-h-screen flex flex-col">
        <Navbar storesPageEnabled={storesPageEnabled} />
        <CategoryNav categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </SiteNameProvider>
  )
}
