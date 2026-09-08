import type { Metadata } from "next"
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo"
import { HomePage } from "./home-page"

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
}

export default async function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: SITE_NAME,
        url: absoluteUrl("/"),
        description: SITE_DESCRIPTION,
        logo: absoluteUrl("/icon.svg"),
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: SITE_NAME,
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
