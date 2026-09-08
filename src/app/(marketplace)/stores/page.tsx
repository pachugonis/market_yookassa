import type { Metadata } from "next"
import { getCatalogSellers } from "@/lib/catalog"
import { absoluteUrl } from "@/lib/seo"
import { StoresPage } from "./stores-page"

export const metadata: Metadata = {
  title: "Магазины",
  description:
    "Продавцы маркетплейса Amazonus: рейтинги, количество товаров и витрины магазинов цифровых товаров.",
  alternates: { canonical: absoluteUrl("/stores") },
}

export default async function Page() {
  const sellers = await getCatalogSellers()

  return <StoresPage sellers={sellers} />
}
