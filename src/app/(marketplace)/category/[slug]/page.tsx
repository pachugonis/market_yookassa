import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { absoluteUrl, SITE_NAME, truncateForMeta } from "@/lib/seo"
import { CategoryProducts } from "./category-products"

interface Props {
  params: Promise<{ slug: string }>
}

// Один запрос на проход рендера: его делят generateMetadata и сама страница.
const getCategory = cache(async (slug: string) => {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      subcategories: {
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
  const description = truncateForMeta(
    category.description ||
      `${category.name} — купить и скачать цифровые товары на ${SITE_NAME}. Безопасная оплата и мгновенная доставка после покупки.`
  )

  return {
    title: `${category.name} — купить и скачать`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      locale: "ru_RU",
      title: `${category.name} — ${SITE_NAME}`,
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

  const products = await prisma.product.findMany({
    where: { 
      categoryId: { in: categoryIds },
      status: "ACTIVE" 
    },
    include: {
      seller: { select: { name: true, avatar: true } },
      category: { select: { name: true, slug: true } },
      reviews: { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const productsWithRating = products.map((product) => {
    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
        : 0
    return {
      id: product.id,
      title: product.title,
      price: product.price,
      coverImage: product.coverImage,
      downloadCount: product.downloadCount,
      seller: product.seller,
      category: product.category,
      avgRating,
    }
  })

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
