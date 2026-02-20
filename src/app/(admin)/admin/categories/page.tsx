import { prisma } from "@/lib/prisma"
import { CategoryManager } from "@/components/admin/category-manager"

async function getCategories() {
  const categories = await prisma.category.findMany({
    where: {
      parentId: null, // Only get top-level categories
    },
    orderBy: { name: "asc" },
    include: {
      subcategories: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      },
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

  return <CategoryManager categories={categories} />
}
