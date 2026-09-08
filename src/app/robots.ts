import type { MetadataRoute } from "next"
import { absoluteUrl, SITE_URL } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Личные кабинеты, служебные и транзакционные разделы: контента для
      // выдачи в них нет, а обход только тратит краулинговый бюджет.
      disallow: [
        "/api/",
        "/admin",
        "/admin-login",
        "/dashboard",
        "/library",
        "/profile",
        "/disputes",
        "/payment/",
        "/login",
        "/register",
        "/verify-email",
        "/maintenance",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  }
}
