import { prisma } from "@/lib/prisma"
import { getCatalogProducts } from "@/lib/catalog"
import { ProductsCatalog } from "./products-catalog"

/**
 * Каталог товаров как самостоятельный кусок страницы.
 *
 * Живёт отдельно от `page.tsx`, потому что отрисовывается по двум
 * адресам: на «/products» всегда и на «/», когда в админке каталог
 * назначен главной страницей. Две копии одной загрузки данных рано или
 * поздно разъехались бы.
 */

export type CatalogSearchParams = { [key: string]: string | string[] | undefined }

export function firstParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

/** Задан ли хоть один фильтр: такие выдачи в индекс не пускаем. */
export function isFilteredCatalog(params: CatalogSearchParams): boolean {
  return Boolean(
    firstParam(params.search) || firstParam(params.category) || firstParam(params.seller)
  )
}

export async function CatalogView({ params }: { params: CatalogSearchParams }) {
  const [products, categories] = await Promise.all([
    getCatalogProducts({
      search: firstParam(params.search),
      category: firstParam(params.category),
      seller: firstParam(params.seller),
      sort: firstParam(params.sort),
    }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: "asc" },
      include: { subcategories: { orderBy: { name: "asc" } } },
    }),
  ])

  return (
    <ProductsCatalog
      initialProducts={products}
      initialCategories={categories}
      filters={{
        search: firstParam(params.search) ?? "",
        category: firstParam(params.category) ?? "",
        seller: firstParam(params.seller) ?? "",
      }}
    />
  )
}
