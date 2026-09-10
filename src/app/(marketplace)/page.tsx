import type { Metadata } from "next"
import { absoluteUrl } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"
import { HomePage } from "./home-page"

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
}

export default async function Page() {
  const { siteName, siteDescription } = await getSiteSettings()

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
      <HomePage />
    </>
  )
}
