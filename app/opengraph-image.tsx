import { ImageResponse } from "next/og"
import { readFileSync } from "fs"
import { join } from "path"

export const alt = "Galicode Vigo — Próximamente"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  const logoSvg = readFileSync(join(process.cwd(), "public/logo.svg"))
  const logoSrc = `data:image/svg+xml;base64,${logoSvg.toString("base64")}`

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
          background:
            "linear-gradient(135deg, #06121e 0%, #0a1a2a 35%, #0d2d3f 65%, #0a1a2a 85%, #06121e 100%)",
          fontFamily: "Georgia, Times New Roman, serif",
        }}
      >
        {/* Decorative gradient blobs */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(15,61,77,0.6) 0%, transparent 70%)",
            top: -100,
            right: -100,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 350,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(13,45,63,0.5) 0%, transparent 70%)",
            bottom: -80,
            left: -80,
          }}
        />

        {/* Real logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={480}
          height={142}
          alt="Galicode Vigo"
          style={{ display: "flex", marginBottom: 40 }}
        />

        {/* Divider */}
        <div
          style={{
            width: 60,
            height: 1,
            background: "rgba(255,255,255,0.25)",
            marginBottom: 28,
            display: "flex",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: 30,
            fontWeight: 400,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.7)",
            letterSpacing: 8,
            display: "flex",
          }}
        >
          Próximamente
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 400,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: 3,
            marginTop: 28,
            display: "flex",
          }}
        >
          GALICODE VIGO · PONTEVEDRA
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 14,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: 2,
            display: "flex",
          }}
        >
          galicode.com
        </div>
      </div>
    ),
    size,
  )
}
