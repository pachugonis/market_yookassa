import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { SITE_URL } from "@/lib/seo";
import { getSiteSettings, siteTitle } from "@/lib/site-settings";

// Шрифты лежат в репозитории, а не грузятся из Google Fonts: next/font/google
// скачивает их во время сборки, и на серверах, откуда Google недоступен,
// сборка падает. Файлы — из npm-пакета geist (OFL, см. fonts/OFL.txt),
// вариативные, с кириллицей.
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Название и описание площадки задаются в админке, поэтому метатеги
// собираются на каждый запрос: статический объект `metadata` запомнил
// бы значения, какими они были на момент сборки.
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteSettings()
  const title = siteTitle(siteName)

  return {
    // Базовый адрес: без него canonical и og:image остаются относительными,
    // а поисковики и мессенджеры такие ссылки не разворачивают.
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      // Страницы задают только свой заголовок, суффикс подставляется сам.
      template: `%s — ${siteName}`,
    },
    description: siteDescription,
    applicationName: siteName,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName,
      url: "/",
      title,
      description: siteDescription,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: siteDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: '/icon.svg',
      apple: '/icon.svg',
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
