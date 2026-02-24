import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { CategoryNav } from "@/components/layout/category-nav"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <CategoryNav categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
