import { prisma } from "@/lib/prisma"
import { CATALOG_PAGE_SIZE, getCatalogProducts, parsePageParam } from "@/lib/catalog"
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
  const page = parsePageParam(params.page)

  const [{ products, total }, categories] = await Promise.all([
    getCatalogProducts({
      search: firstParam(params.search),
      category: firstParam(params.category),
      seller: firstParam(params.seller),
      sort: firstParam(params.sort),
      page,
    }),
    prisma.category.findMany({
      where: { parentId: null, isHidden: false },
      orderBy: { name: "asc" },
      include: { subcategories: { where: { isHidden: false }, orderBy: { name: "asc" } } },
    }),
  ])

  return (
    <ProductsCatalog
      initialProducts={products}
      initialCategories={categories}
      // Число страниц считаем здесь: `CATALOG_PAGE_SIZE` живёт рядом с
      // выборкой, а тот модуль тянет за собой Prisma — в клиентский
      // компонент его импортировать нельзя.
      initialPagination={{
        page,
        total,
        totalPages: Math.ceil(total / CATALOG_PAGE_SIZE),
      }}
      filters={{
        search: firstParam(params.search) ?? "",
        category: firstParam(params.category) ?? "",
        seller: firstParam(params.seller) ?? "",
      }}
    />
  )
}
