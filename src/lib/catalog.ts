import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Категория видна на сайте, если не скрыта ни она сама, ни её родитель:
 * скрытие раздела в админке прячет и все его подкатегории.
 */
export const visibleCategoryWhere = {
  isHidden: false,
  OR: [{ parentId: null }, { parent: { isHidden: false } }],
} satisfies Prisma.CategoryWhereInput

/**
 * Товар, который можно показать и продать: активный и из видимой категории.
 * Товары скрытой категории ведут себя как снятые с продажи — их нет в
 * выдаче, карточка отвечает 404, оплату не создать.
 */
export const visibleProductWhere = {
  status: "ACTIVE",
  category: visibleCategoryWhere,
} satisfies Prisma.ProductWhereInput

/**
 * Тип файла по расширению — всё, что покупатель узнаёт о файле до оплаты.
 * Само имя не показываем: продавцы называют файлы по содержимому
 * («encryption-keys.json»), и имя раскрывает товар раньше покупки.
 */
export function fileTypeLabel(fileName: string): string {
  const ext = fileName.match(/\.([A-Za-z0-9]{1,10})$/)?.[1]
  return ext ? ext.toUpperCase() : "Файл"
}

/**
 * Карточка товара для всех посетителей — страница /products/[id] и
 * публичный GET /api/products/[id]. Поля перечислены явно: fileUrl
 * (путь к продаваемому файлу), имя файла, id ключей и покупателей
 * наружу не уходят.
 */
export async function getPublicProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id, ...visibleProductWhere },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      coverImage: true,
      fileName: true,
      fileSize: true,
      downloadCount: true,
      hasLicenseKeys: true,
      createdAt: true,
      seller: {
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          _count: { select: { products: true } },
        },
      },
      category: { select: { name: true, slug: true } },
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          buyer: { select: { name: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      images: {
        select: { id: true, imageUrl: true, order: true },
        orderBy: { order: "asc" },
      },
      _count: {
        select: {
          reviews: true,
          purchases: true,
          licenseKeys: { where: { isSold: false } },
        },
      },
    },
  })

  if (!product) return null

  const {
    fileName,
    hasLicenseKeys,
    _count: { licenseKeys: unsoldKeys, ...counts },
    ...rest
  } = product

  return {
    ...rest,
    fileType: fileTypeLabel(fileName),
    _count: counts,
    // null — товар без ключей, запас не ограничен
    availableStock: hasLicenseKeys ? unsoldKeys : null,
  }
}

export type PublicProduct = NonNullable<Awaited<ReturnType<typeof getPublicProduct>>>

export interface CatalogSeller {
  id: string
  name: string
  avatar: string | null
  createdAt: string
  _count: { products: number }
  products: Array<{ id: string; reviews: Array<{ rating: number }> }>
}

/**
 * Продавцы с хотя бы одним видимым товаром — витрина /stores и /api/sellers.
 * Эндпоинт публичный, поэтому email наружу не отдаём.
 */
export async function getCatalogSellers(): Promise<CatalogSeller[]> {
  const sellers = await prisma.user.findMany({
    where: {
      role: { in: ["SELLER", "ADMIN"] },
      products: { some: visibleProductWhere },
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      _count: { select: { products: { where: visibleProductWhere } } },
      products: {
        where: visibleProductWhere,
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

  const where: Record<string, unknown> = { ...visibleProductWhere }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }

  if (category && category !== "all") {
    where.category = { ...visibleCategoryWhere, slug: category }
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

  // Столбцы перечислены явно: `include` вёз строку товара целиком, вместе
  // с описанием и путём к продаваемому файлу, а карточке нужны восемь полей.
  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      title: true,
      price: true,
      coverImage: true,
      downloadCount: true,
      seller: { select: { name: true, avatar: true } },
      category: { select: { name: true, slug: true } },
      images: { select: { imageUrl: true }, orderBy: { order: "asc" } },
    },
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  })

  // Средний балл считает база — одним запросом на всю страницу выдачи
  // вместо всех строк отзывов каждого товара.
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

  return products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.price,
    coverImage: product.coverImage,
    downloadCount: product.downloadCount,
    seller: product.seller,
    category: product.category,
    avgRating: avgByProduct.get(product.id) ?? 0,
    images: product.images.map((img) => img.imageUrl),
  }))
}
