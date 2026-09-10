import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { absoluteUrl, truncateForMeta } from "@/lib/seo"
import { getSiteName } from "@/lib/site-settings"
import { ProductDetail } from "./product-detail"

interface Props {
  params: Promise<{ id: string }>
}

/**
 * generateMetadata и сам рендер страницы просят одни и те же данные.
 * cache() схлопывает это в один запрос к базе за проход рендера.
 */
const getProduct = cache(async (id: string) => {
  return prisma.product.findUnique({
    where: { id, status: "ACTIVE" },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          _count: { select: { products: true } }
        }
      },
      category: true,
      reviews: {
        include: {
          buyer: { select: { name: true, avatar: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      },
      images: {
        select: { id: true, imageUrl: true, order: true },
        orderBy: { order: "asc" }
      },
      _count: { select: { reviews: true, purchases: true } },
      licenseKeys: {
        where: { isSold: false },
        select: { id: true }
      }
    }
  })
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)

  if (!product) {
    return { title: "Товар не найден" }
  }

  const url = absoluteUrl(`/products/${product.id}`)
  const siteName = await getSiteName()
  const description = truncateForMeta(product.description)
  const images = product.coverImage ? [absoluteUrl(product.coverImage)] : undefined

  return {
    title: `${product.title} — ${product.category.name}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName,
      locale: "ru_RU",
      title: product.title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images,
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params

  const product = await getProduct(id)

  if (!product) {
    notFound()
  }

  const avgRating = product.reviews.length > 0
    ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
    : 0

  const availableStock = product.hasLicenseKeys ? product.licenseKeys.length : null

  const inStock = availableStock === null || availableStock > 0

  // Микроразметка товара: без неё в выдаче не будет ни цены, ни звёзд рейтинга.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: truncateForMeta(product.description, 500),
    sku: product.id,
    category: product.category.name,
    ...(product.coverImage
      ? {
          image: [
            absoluteUrl(product.coverImage),
            ...product.images.map((img) => absoluteUrl(img.imageUrl)),
          ],
        }
      : {}),
    brand: { "@type": "Brand", name: product.seller.name },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${product.id}`),
      price: product.price,
      priceCurrency: "RUB",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: product.seller.name },
    },
    ...(product._count.reviews > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(avgRating.toFixed(1)),
            reviewCount: product._count.reviews,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Каталог", item: absoluteUrl("/products") },
      {
        "@type": "ListItem",
        position: 3,
        name: product.category.name,
        item: absoluteUrl(`/category/${product.category.slug}`),
      },
      { "@type": "ListItem", position: 4, name: product.title },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductDetail product={product} avgRating={avgRating} availableStock={availableStock} />
    </>
  )
}
