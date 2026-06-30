import { Logo } from "@/components/logo"
import { EmailForm } from "@/components/email-form"
import { OceanShader } from "@/components/ocean-shader"

// ─── Copy constants — edit here to update all visible text ───────────────────
const COPY = {
  heading: "Web en construcción",
  tagline: "Especialistas en producto del mar. Muy pronto.",
  cta: "Recibe novedades, tarifas y ofertas, o escríbenos directamente con tu consulta.",
  legal:
    "Al enviarnos tu email, aceptas que Galicode Vigo S.L. lo use para responderte y enviarte información comercial relevante. Sin spam.",
  footer: {
    name: "Galicode Vigo S.L.",
    nif: "NIF ESB27865492",
    email: "gestion@galicode.com",
    address: "Calle Rosalía de Castro, 1 · Loc. 9 · 36001 Pontevedra",
  },
} as const

export default function Page() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-6 py-16 text-white">
      <OceanShader />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-8 text-center sm:max-w-2xl">
        {/* Logo + Heading */}
        <div className="animate-in fade-in slide-in-from-top-4 flex flex-col items-center gap-5 duration-700">
          <Logo />
          <h1 className="font-display text-2xl font-normal italic leading-none tracking-[-0.01em] text-white/60 sm:text-3xl md:text-4xl">
            {COPY.heading}
          </h1>
        </div>

        {/* Email form */}
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <EmailForm />
        </div>

        {/* Supporting text */}
        <div className="animate-in fade-in duration-700 delay-500 flex flex-col gap-2">
          <p className="text-base leading-relaxed text-white/85">{COPY.tagline}</p>
          <p className="text-sm leading-relaxed text-white/65">{COPY.cta}</p>
        </div>

        {/* GDPR notice */}
        <p className="animate-in fade-in duration-700 delay-700 text-xs leading-relaxed text-white/40">
          {COPY.legal}
        </p>
      </div>

      {/* Footer legal */}
      <footer className="absolute bottom-6 left-0 right-0 z-10 animate-in fade-in duration-700 delay-700">
        <div className="flex flex-col items-center gap-1 text-center text-[11px] leading-relaxed text-white/30">
          <span>
            {COPY.footer.name} · {COPY.footer.nif} · {COPY.footer.address}
          </span>
          <a
            href={`mailto:${COPY.footer.email}`}
            className="transition-colors hover:text-white/50 focus-visible:text-white/50 focus-visible:outline-none focus-visible:underline"
          >
            {COPY.footer.email}
          </a>
        </div>
      </footer>
    </main>
  )
}
