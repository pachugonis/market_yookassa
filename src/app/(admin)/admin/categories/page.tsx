import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"

async function getCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
    },
  })
  return categories
}

export default async function CategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Категории</h1>
        <p className="text-muted-foreground mt-2">Управление категориями товаров</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((category: any) => (
          <Card key={category.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">{category.icon}</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{category.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Товаров:</span>
                <span className="text-lg font-bold">{category._count.products}</span>
              </div>
              <code className="text-xs bg-secondary px-2 py-1 rounded">
                /{category.slug}
              </code>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Статистика категорий</h3>
        <div className="space-y-3">
          {categories
            .sort((a: any, b: any) => b._count.products - a._count.products)
            .map((category: any) => (
              <div key={category.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{category.icon}</span>
                  <span className="font-medium">{category.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-64 bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${Math.min((category._count.products / Math.max(...categories.map((c: any) => c._count.products))) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">
                    {category._count.products}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
