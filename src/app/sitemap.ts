import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/seo"

// Считаем на каждый запрос: во время сборки образа DATABASE_URL — заглушка
// (см. Dockerfile), и при пререндере в карту попал бы только статичный список
// без единого товара. Боты ходят сюда редко, лишний запрос к базе не страшен.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/stores"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/support"), changeFrequency: "monthly", priority: 0.4 },
  ]

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({ select: { slug: true } }),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, updatedAt: true, coverImage: true },
        orderBy: { updatedAt: "desc" },
        // Лимит Google — 50 000 URL на файл.
        take: 45000,
      }),
    ])

    return [
      ...staticEntries,
      ...categories.map((category) => ({
        url: absoluteUrl(`/category/${category.slug}`),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...products.map((product) => ({
        url: absoluteUrl(`/products/${product.id}`),
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        images: product.coverImage ? [absoluteUrl(product.coverImage)] : undefined,
      })),
    ]
  } catch (error) {
    // Без базы отдаём хотя бы статичную часть: пустой sitemap для поисковика
    // хуже, чем неполный.
    console.error("Error building sitemap:", error)
    return staticEntries
  }
}
