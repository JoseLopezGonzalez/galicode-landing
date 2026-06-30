"use client"

import { useState } from "react"
import { EmailForm, type Mode } from "@/components/email-form"

export function ContactSection({
  tagline,
  cta,
  legal,
}: {
  tagline: string
  cta: string
  legal: string
}) {
  const [mode, setMode] = useState<Mode>("subscribe")

  return (
    <>
      {/* Email form */}
      <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <EmailForm onModeChange={setMode} />
      </div>

      {/* Supporting text */}
      <div className="animate-in fade-in duration-700 delay-500 flex flex-col gap-2">
        <p className="text-base leading-relaxed text-white/85">{tagline}</p>
        <p className="text-sm leading-relaxed text-white/65">{cta}</p>
      </div>

      {/* GDPR notice — hidden on mobile while the contact form is open to save space */}
      <p
        className={`animate-in fade-in duration-700 delay-700 text-xs leading-relaxed text-white/40 ${
          mode === "contact" ? "hidden sm:block" : ""
        }`}
      >
        {legal}
      </p>
    </>
  )
}
