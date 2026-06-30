# Next.js Conventions — Galicode Landing

## Versión
Next.js 16, App Router, React 19.

## Server Components por defecto
Todo componente es Server Component salvo que necesite interactividad explícita.

## Client Components — cuándo añadir `'use client'`
Solo para:
- `EmailForm` → usa `useState`, `fetch`, event handlers
- Cualquier componente con `useEffect` o hooks de estado

## Componentes actuales y su naturaleza
| Componente | Tipo | Motivo |
|---|---|---|
| `app/layout.tsx` | Server | metadata, JSON-LD |
| `app/page.tsx` | Server | shell estático, composición |
| `components/logo.tsx` | Server | solo JSX estático |
| `components/fluid-background.tsx` | Server | solo CSS, sin JS |
| `components/email-form.tsx` | **Client** | useState, fetch, Vercel Analytics |

## API Routes
- Ruta: `app/api/subscribe/route.ts`
- Solo método POST
- Validación Zod 4 server-side
- Rate limiting en memoria (simple Map, suficiente para landing)

## Fonts (next/font/google)
- `Inter` → variable `--font-sans` → clase `font-sans`
- `Playfair_Display` → variable `--font-display` → clase `font-display`

## Metadata
- Exportar `metadata: Metadata` desde `app/layout.tsx`
- `metadataBase` apunta a `NEXT_PUBLIC_SITE_URL`
- OG image generada dinámicamente en `app/opengraph-image.tsx` con `ImageResponse`

## Imports
- Usar alias `@/` para todo (configurado en `tsconfig.json`)

## TypeScript
- Strict mode activado
- Sin `any` explícitos
- Preferir `unknown` sobre `any` en boundaries de datos externos

## Variables de entorno
- Server-only: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAILS`
- Client-accessible (prefijo NEXT_PUBLIC_): `NEXT_PUBLIC_SITE_URL`
