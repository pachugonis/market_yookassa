import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { getSiteName, siteTitle } from "@/lib/site-settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Название площадки задаётся в админке, поэтому метатеги собираются на
// каждый запрос: статический объект `metadata` запомнил бы значение,
// каким оно было на момент сборки.
export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()
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
    description: SITE_DESCRIPTION,
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
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: SITE_DESCRIPTION,
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
