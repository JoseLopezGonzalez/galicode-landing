import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Resend } from "resend"

const schema = z.object({
  email: z.string().email(),
  mode: z.enum(["subscribe", "contact"]).default("subscribe"),
  message: z.string().max(2000).optional(),
})

// In-memory rate limiter: max 3 requests per IP per hour.
// Resets on server restart — acceptable for a landing page.
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 60 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT) return true

  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo más tarde." },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
  }

  const { email, mode, message } = result.data

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("[subscribe] RESEND_API_KEY not configured")
    return NextResponse.json(
      { error: "Error de configuración del servidor." },
      { status: 500 },
    )
  }

  // Default from: Resend sandbox domain works without DNS verification.
  // Replace with a verified @galicode.com sender once DNS is configured.
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
  const to = (
    process.env.RESEND_TO_EMAILS ??
    "gestion@galicode.com,administracion@galicode.com"
  )
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)

  const resend = new Resend(apiKey)

  const subject =
    mode === "contact"
      ? `Consulta desde Galicode.com — ${email}`
      : `Nueva suscripción Galicode — ${email}`

  const html =
    mode === "contact"
      ? `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2 style="color:#0a1a2a;margin-bottom:8px">Nueva consulta desde la web</h2>
          <p style="color:#444;margin-bottom:4px"><strong>De:</strong> ${email}</p>
          <div style="margin-top:16px;background:#f5f5f5;padding:16px;border-radius:6px;color:#222;white-space:pre-wrap">${message ?? ""}</div>
          <p style="color:#888;font-size:12px;margin-top:24px">
            Enviado desde galicode.com · Galicode Vigo S.L.
          </p>
        </div>
      `
      : `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0a1a2a;margin-bottom:8px">Nueva suscripción</h2>
          <p style="color:#444;margin-bottom:16px">
            Alguien ha dejado su email en la landing de Galicode:
          </p>
          <p style="font-size:18px;font-weight:bold;color:#06121e;background:#f5f5f5;padding:12px 16px;border-radius:6px">
            ${email}
          </p>
          <p style="color:#888;font-size:12px;margin-top:24px">
            Enviado desde galicode.com · Galicode Vigo S.L.
          </p>
        </div>
      `

  try {
    await resend.emails.send({ from, to, subject, html })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[subscribe] Resend error:", err)
    return NextResponse.json(
      { error: "Error al enviar. Inténtalo de nuevo." },
      { status: 500 },
    )
  }
}
