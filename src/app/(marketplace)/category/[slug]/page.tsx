import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { visibleCategoryWhere, visibleProductWhere } from "@/lib/catalog"
import { prisma } from "@/lib/prisma"
import { absoluteUrl, truncateForMeta } from "@/lib/seo"
import { getSiteName } from "@/lib/site-settings"
import { CategoryProducts } from "./category-products"

interface Props {
  params: Promise<{ slug: string }>
}

// Один запрос на проход рендера: его делят generateMetadata и сама страница.
// Скрытая категория (или подкатегория скрытой) для сайта не существует.
const getCategory = cache(async (slug: string) => {
  return prisma.category.findUnique({
    where: { slug, ...visibleCategoryWhere },
    include: {
      subcategories: {
        where: { isHidden: false },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { products: true }
          }
        }
      }
    }
  })
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategory(slug)

  if (!category) {
    return { title: "Категория не найдена" }
  }

  const url = absoluteUrl(`/category/${category.slug}`)
  const siteName = await getSiteName()
  const description = truncateForMeta(
    category.description ||
      `${category.name} — купить и скачать цифровые товары на ${siteName}. Безопасная оплата и мгновенная доставка после покупки.`
  )

  return {
    title: `${category.name} — купить и скачать`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName,
      locale: "ru_RU",
      title: `${category.name} — ${siteName}`,
      description,
    },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params

  const category = await getCategory(slug)

  if (!category) {
    notFound()
  }

  // Get all category IDs (current category + subcategories)
  const categoryIds = [category.id, ...(category.subcategories?.map(sub => sub.id) || [])]

  // Столбцы перечислены явно: карточке нужно восемь полей, а `include`
  // вёз строку товара целиком — с описанием и путём к продаваемому файлу.
  const products = await prisma.product.findMany({
    where: {
      ...visibleProductWhere,
      categoryId: { in: categoryIds },
    },
    select: {
      id: true,
      title: true,
      price: true,
      coverImage: true,
      downloadCount: true,
      seller: { select: { name: true, avatar: true } },
      category: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Средний балл считает база. Раньше сюда приезжали все строки отзывов
  // всех товаров категории, и среднее складывалось в JS: на сотне
  // товаров с сотней отзывов это десять тысяч строк ради одного числа
  // под каждой карточкой.
  const productIds = products.map((product) => product.id)
  const ratings = productIds.length
    ? await prisma.review.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
      })
    : []

  const avgByProduct = new Map(
    ratings.map((row) => [row.productId, row._avg.rating ?? 0])
  )

  const productsWithRating = products.map((product) => ({
    ...product,
    avgRating: avgByProduct.get(product.id) ?? 0,
  }))

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Каталог", item: absoluteUrl("/products") },
      { "@type": "ListItem", position: 3, name: category.name },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <CategoryProducts category={category} products={productsWithRating} subcategories={category.subcategories || []} />
    </>
  )
}
