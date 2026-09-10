import { ImageResponse } from "next/og"
import { SITE_TAGLINE } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
// Название сюда не подставить: `alt` — статичный экспорт, он попал бы в
// разметку тем, каким был на момент сборки. Название и так написано на
// самой картинке.
export const alt = SITE_TAGLINE

// Название и описание меняются в админке — рисуем картинку на каждый
// запрос, иначе в репостах осталось бы имя времён сборки образа.
export const dynamic = "force-dynamic"

// Картинка-заглушка для репостов: используется везде, где страница
// не задала собственный og:image.
export default async function OpengraphImage() {
  const { siteName, siteDescription } = await getSiteSettings()

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%)",
          color: "#f8fafc",
          padding: "0 96px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: "-0.03em" }}>
          {siteName}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 36,
            lineHeight: 1.35,
            color: "#cbd5e1",
            maxWidth: 900,
          }}
        >
          {siteDescription}
        </div>
      </div>
    ),
    size
  )
}
