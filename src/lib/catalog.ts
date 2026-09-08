import { prisma } from "@/lib/prisma"

export interface CatalogSeller {
  id: string
  name: string
  avatar: string | null
  createdAt: string
  _count: { products: number }
  products: Array<{ id: string; reviews: Array<{ rating: number }> }>
}

/**
 * Продавцы с хотя бы одним активным товаром — витрина /stores и /api/sellers.
 * Эндпоинт публичный, поэтому email наружу не отдаём.
 */
export async function getCatalogSellers(): Promise<CatalogSeller[]> {
  const sellers = await prisma.user.findMany({
    where: {
      role: { in: ["SELLER", "ADMIN"] },
      products: { some: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
      products: {
        where: { status: "ACTIVE" },
        select: { id: true, reviews: { select: { rating: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return sellers.map((seller) => ({
    ...seller,
    createdAt: seller.createdAt.toISOString(),
  }))
}

export interface CatalogFilters {
  search?: string | null
  category?: string | null
  seller?: string | null
  sort?: string | null
  page?: number
  limit?: number
}

export interface CatalogProduct {
  id: string
  title: string
  price: number
  coverImage: string | null
  downloadCount: number
  seller: { name: string; avatar: string | null }
  category: { name: string; slug: string }
  avgRating: number
  images: string[]
}

/**
 * Единый источник выборки каталога: используется и в /api/products, и при
 * серверном рендеринге /products. Держим в одном месте, чтобы фильтры и
 * сортировка в HTML и в XHR-ответе не разъезжались.
 */
export async function getCatalogProducts(
  filters: CatalogFilters
): Promise<CatalogProduct[]> {
  const { search, category, seller, sort = "newest" } = filters
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 20

  const where: Record<string, unknown> = {
    status: "ACTIVE",
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }

  if (category && category !== "all") {
    where.category = { slug: category }
  }

  if (seller) {
    where.sellerId = seller
  }

  let orderBy: Record<string, unknown> = { createdAt: "desc" }
  if (sort === "popular") {
    orderBy = { downloadCount: "desc" }
  } else if (sort === "price_asc") {
    orderBy = { price: "asc" }
  } else if (sort === "price_desc") {
    orderBy = { price: "desc" }
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      seller: { select: { name: true, avatar: true } },
      category: { select: { name: true, slug: true } },
      reviews: { select: { rating: true } },
      images: { select: { imageUrl: true, order: true }, orderBy: { order: "asc" } },
    },
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  })

  return products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.price,
    coverImage: product.coverImage,
    downloadCount: product.downloadCount,
    seller: product.seller,
    category: product.category,
    avgRating:
      product.reviews.length > 0
        ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
        : 0,
    images: product.images.map((img) => img.imageUrl),
  }))
}
