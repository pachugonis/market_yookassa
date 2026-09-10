import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCatalogSellers } from "@/lib/catalog"
import { isStoresPageEnabled } from "@/lib/platform-mode"
import { absoluteUrl } from "@/lib/seo"
import { StoresPage } from "./stores-page"

export const metadata: Metadata = {
  title: "Магазины",
  description:
    "Продавцы маркетплейса Amazonus: рейтинги, количество товаров и витрины магазинов цифровых товаров.",
  alternates: { canonical: absoluteUrl("/stores") },
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
