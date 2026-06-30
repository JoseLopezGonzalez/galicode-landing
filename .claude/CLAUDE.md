# Galicode Landing — Contexto del proyecto

## Descripción
Landing "Coming Soon" de una sola página para **Galicode Vigo S.L.**, distribuidora sin almacén especializada en pulpo y productos del mar que amplía operación con mayor visibilidad de marca.

## Datos de la empresa
- **Razón social**: Galicode Vigo S.L.
- **NIF/VAT**: ESB27865492
- **Domicilio**: Calle Rosalía de Castro, 1 - Loc. 9, 36001 Pontevedra, España
- **Email gestión**: gestion@galicode.com
- **Email administración**: administracion@galicode.com
- **Modelo de negocio**: Distribuidora sin almacén (cross-docking / trading), especializada en pulpo, en expansión con nuevo socio de producción

## Stack técnico
- **Framework**: Next.js 16 (App Router, React 19)
- **Lenguaje**: TypeScript estricto
- **Estilos**: Tailwind CSS 4
- **Componentes**: shadcn/ui (radix-rhea style)
- **Fuentes**: Playfair Display (display serif, heading) + Inter (body)
- **Email transaccional**: Resend (solo notificación, sin base de datos de suscriptores)
- **Analytics**: Vercel Analytics (sin cookies, sin banner)
- **Validación**: Zod 4

## Alcance actual
**SOLO** landing Coming Soon de una página. Sin rutas adicionales, sin backend propio, sin CMS, sin multi-tenancy.

## Formulario de suscripción
- API Route: `/app/api/subscribe/route.ts`
- Envía email a `gestion@galicode.com` y `administracion@galicode.com` via Resend
- **NO** persiste datos en ninguna base de datos
- Rate limiting básico en memoria (3 req/hora por IP)
- Validación server-side con Zod

## Identidad visual
- Logo: componente `<Logo />` en `components/logo.tsx`
- Mientras no exista `/public/logo.svg` → muestra wordmark en texto "GALICODE"
- Paleta marina oscura (ver `.claude/rules/design-system.md`)
- Fondo fluido animado en CSS puro (ver `.claude/skills/fluid-background/SKILL.md`)

## Variables de entorno requeridas
```
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_TO_EMAILS=gestion@galicode.com,administracion@galicode.com
NEXT_PUBLIC_SITE_URL=https://galicode.com
```

## Regla de prioridad de skills
Los skills en `.claude/skills/` tienen prioridad sobre skills externos si hay conflicto.

## Idioma de la landing
Español (mercado principal). Textos como constantes en la parte superior del componente página.

## FASE 1 — Nota sobre skills externos
`npx skills add` (vercel-labs/skills) no existe como paquete npm público — no está publicado.
Skills de búsqueda evaluados:
- Fluid gradient/animated backgrounds: no encontrado como skill verificado con >1000 instalaciones → implementado en CSS puro (ver `.claude/skills/fluid-background/SKILL.md`)
- Email capture glassmorphism: no encontrado → implementado directamente
- Animaciones de entrada: `tw-animate-css` ya instalado en el proyecto — usado para fade-in del contenido

## Notas pendientes de configuración
- Verificar dominio galicode.com en Resend (SPF/DKIM) para enviar desde @galicode.com
- Subir logo real a `/public/logo.svg` o `/public/logo.png`
- Configurar variables de entorno en Vercel dashboard
