import type { Metadata, Viewport } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"

import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  weight: ["400", "700"],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://galicode.com"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Galicode Vigo S.L.",
  description:
    "Galicode Vigo S.L., empresa distribuidora con sede en Pontevedra. Muy pronto, una presencia digital a la altura de lo que somos.",
  keywords: [
    "distribución mayorista",
    "comercio mayorista",
    "productos del mar",
    "Galicia",
    "Pontevedra",
    "mariscos",
    "distribuidor mayorista",
    "sector alimentario",
    "Galicode",
    "Galicode Vigo",
  ],
  authors: [{ name: "Galicode Vigo S.L." }],
  creator: "Galicode Vigo S.L.",
  publisher: "Galicode Vigo S.L.",
  alternates: {
    canonical: "/",
  },
  // Indexar desde el día 1 mejora SEO. Cambiar index: false para suprimir temporalmente.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "Galicode Vigo — Próximamente",
    description:
      "Galicode Vigo S.L. Muy pronto, en este espacio.",
    type: "website",
    url: SITE_URL,
    siteName: "Galicode Vigo",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Galicode Vigo — Próximamente",
    description:
      "Galicode Vigo S.L. Muy pronto, en este espacio.",
  },
}

export const viewport: Viewport = {
  themeColor: "#06121e",
  width: "device-width",
  initialScale: 1,
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Galicode Vigo S.L.",
  legalName: "Galicode Vigo S.L.",
  vatID: "ESB27865492",
  email: "gestion@galicode.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Calle Rosalía de Castro, 1 - Loc. 9",
    postalCode: "36001",
    addressLocality: "Pontevedra",
    addressCountry: "ES",
  },
  url: SITE_URL,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable} antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
