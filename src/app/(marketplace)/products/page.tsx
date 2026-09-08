import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { getCatalogProducts } from "@/lib/catalog"
import { absoluteUrl } from "@/lib/seo"
import { ProductsCatalog } from "./products-catalog"

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const isFiltered = Boolean(
    first(params.search) || first(params.category) || first(params.seller)
  )

  return {
    title: "Каталог цифровых товаров",
    description:
      "Каталог цифровых товаров: программы, игры, музыка, графика, шаблоны и электронные книги. Мгновенное скачивание после оплаты.",
    // Отфильтрованные выдачи — это тот же каталог под другим адресом.
    // Канонический адрес один, а сами комбинации фильтров в индекс не пускаем.
    alternates: { canonical: absoluteUrl("/products") },
    robots: isFiltered ? { index: false, follow: true } : undefined,
  }
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams

  const [products, categories] = await Promise.all([
    getCatalogProducts({
      search: first(params.search),
      category: first(params.category),
      seller: first(params.seller),
      sort: first(params.sort),
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
        search: first(params.search) ?? "",
        category: first(params.category) ?? "",
        seller: first(params.seller) ?? "",
      }}
    />
  )
}
