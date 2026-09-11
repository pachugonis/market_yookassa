import type { Metadata } from "next"
import { isCatalogHomePage } from "@/lib/platform-mode"
import { absoluteUrl } from "@/lib/seo"
import { CatalogSearchParams, CatalogView, isFilteredCatalog } from "./catalog-view"

interface Props {
  searchParams: Promise<CatalogSearchParams>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const isFiltered = isFilteredCatalog(params)
  const catalogIsHome = await isCatalogHomePage()

  return {
    title: "Каталог цифровых товаров",
    description:
      "Каталог цифровых товаров: программы, игры, музыка, графика, шаблоны и электронные книги. Мгновенное скачивание после оплаты.",
    // Отфильтрованные выдачи — это тот же каталог под другим адресом.
    // Канонический адрес один, а сами комбинации фильтров в индекс не пускаем.
    // Когда каталог назначен главной, канонический адрес у него «/»:
    // содержимое там то же самое, а короткий адрес важнее.
    alternates: { canonical: absoluteUrl(catalogIsHome ? "/" : "/products") },
    robots: isFiltered ? { index: false, follow: true } : undefined,
  }
}

export default async function ProductsPage({ searchParams }: Props) {
  return <CatalogView params={await searchParams} />
}
