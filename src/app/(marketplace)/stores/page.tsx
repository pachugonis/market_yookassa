import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCatalogSellers } from "@/lib/catalog"
import { isStoresPageEnabled } from "@/lib/platform-mode"
import { absoluteUrl } from "@/lib/seo"
import { getSiteName } from "@/lib/site-settings"
import { StoresPage } from "./stores-page"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()

  return {
    title: "Магазины",
    description: `Продавцы маркетплейса ${siteName}: рейтинги, количество товаров и витрины магазинов цифровых товаров.`,
    alternates: { canonical: absoluteUrl("/stores") },
  }
}

export default async function Page() {
  // Выключенная в админке витрина не должна оставаться доступной по
  // прямой ссылке: страница отдаёт 404 и помечается noindex.
  if (!(await isStoresPageEnabled())) {
    notFound()
  }

  const sellers = await getCatalogSellers()

  return <StoresPage sellers={sellers} />
}
