import type { Metadata } from "next"
import { BannerCarousel } from "@/components/home/banner-carousel"
import { getActiveBanners } from "@/lib/banners"
import { parsePageParam } from "@/lib/catalog"
import { isCatalogHomePage } from "@/lib/platform-mode"
import { absoluteUrl } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"
import {
  CatalogSearchParams,
  CatalogView,
  isFilteredCatalog,
} from "./products/catalog-view"
import { HomePage } from "./home-page"

interface Props {
  searchParams: Promise<CatalogSearchParams>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // Заголовок и описание у главной остаются фирменными — из корневого
  // layout — независимо от того, лендинг там или каталог: это лицо
  // площадки, а не очередная страница каталога.
  const metadata: Metadata = {
    alternates: { canonical: absoluteUrl("/") },
  }

  // Каталог на главной принимает те же фильтры, что и «/products»,
  // и точно так же не должен плодить в индексе копии под фильтрами.
  // На лендинге эти параметры ничего не значат — и скрывать из индекса
  // главную из-за случайного «?search=» в ссылке нельзя.
  // Вторая страница каталога на главной — тоже копия под другим адресом.
  if (await isCatalogHomePage()) {
    const params = await searchParams

    if (isFilteredCatalog(params) || parsePageParam(params.page) > 1) {
      metadata.robots = { index: false, follow: true }
    }
  }

  return metadata
}

export default async function Page({ searchParams }: Props) {
  const [{ siteName, siteDescription }, catalogIsHome, banners] = await Promise.all([
    getSiteSettings(),
    isCatalogHomePage(),
    getActiveBanners(),
  ])

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: siteName,
        url: absoluteUrl("/"),
        description: siteDescription,
        logo: absoluteUrl("/icon.svg"),
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: siteName,
        url: absoluteUrl("/"),
        inLanguage: "ru-RU",
        publisher: { "@id": absoluteUrl("/#organization") },
        // Даёт Google возможность показать строку поиска по сайту прямо в выдаче.
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: absoluteUrl("/products?search={search_term_string}"),
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Карусель — принадлежность главной, а не каталога: на «/products»
          её нет, даже когда каталог назначен главной. */}
      <BannerCarousel banners={banners} />
      {catalogIsHome ? <CatalogView params={await searchParams} /> : <HomePage />}
    </>
  )
}
