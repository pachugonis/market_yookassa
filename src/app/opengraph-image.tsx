import { ImageResponse } from "next/og"
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = `${SITE_NAME} — маркетплейс цифровых товаров`

// Картинка-заглушка для репостов: используется везде, где страница
// не задала собственный og:image.
export default function OpengraphImage() {
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
          {SITE_NAME}
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
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    size
  )
}
