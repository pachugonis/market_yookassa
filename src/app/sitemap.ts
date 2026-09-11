import type { MetadataRoute } from "next"
import { visibleCategoryWhere, visibleProductWhere } from "@/lib/catalog"
import { isCatalogHomePage, isStoresPageEnabled } from "@/lib/platform-mode"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/seo"

// Считаем на каждый запрос: во время сборки образа DATABASE_URL — заглушка
// (см. Dockerfile), и при пререндере в карту попал бы только статичный список
// без единого товара. Боты ходят сюда редко, лишний запрос к базе не страшен.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    // Каталог живёт не здесь: когда он назначен главной, его адрес в карте
    // уже есть — это «/», и второй адрес с тем же содержимым туда не нужен.
    // Витрина продавцов — тоже ниже, она зависит от настройки.
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/support"), changeFrequency: "monthly", priority: 0.4 },
  ]

  try {
    const [storesEnabled, catalogIsHome, categories, products] = await Promise.all([
      isStoresPageEnabled(),
      isCatalogHomePage(),
      prisma.category.findMany({ where: visibleCategoryWhere, select: { slug: true } }),
      prisma.product.findMany({
        where: visibleProductWhere,
        select: { id: true, updatedAt: true, coverImage: true },
        orderBy: { updatedAt: "desc" },
        // Лимит Google — 50 000 URL на файл.
        take: 45000,
      }),
    ])

    return [
      ...staticEntries,
      ...(catalogIsHome
        ? []
        : [
            {
              url: absoluteUrl("/products"),
              changeFrequency: "daily" as const,
              priority: 0.9,
            },
          ]),
      ...(storesEnabled
        ? [
            {
              url: absoluteUrl("/stores"),
              changeFrequency: "weekly" as const,
              priority: 0.7,
            },
          ]
        : []),
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
    // хуже, чем неполный. Настройку главной прочитать не удалось — каталог
    // отдаём по его собственному адресу, он рабочий в любом случае.
    console.error("Error building sitemap:", error)
    return [
      ...staticEntries,
      { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    ]
  }
}
