"use client"

import { useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { track } from "@vercel/analytics"
import { motion, AnimatePresence } from "motion/react"
import type { Transition } from "motion/react"

type Status = "idle" | "loading" | "success" | "error"
type Mode = "subscribe" | "contact"

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Spring used for the pill slider and card resize
const spring: Transition = { type: "spring", stiffness: 500, damping: 40, mass: 0.6 }

export function EmailForm() {
  const [mode, setMode] = useState<Mode>("subscribe")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  function handleModeChange(next: Mode) {
    if (next === mode) return
    setMode(next)
    setStatus("idle")
    setErrorMsg("")
  }

  function clearError() {
    if (status === "error") {
      setStatus("idle")
      setErrorMsg("")
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!isValidEmail(email)) {
      setErrorMsg("Por favor, introduce un email válido.")
      setStatus("error")
      return
    }

    if (mode === "contact" && !message.trim()) {
      setErrorMsg("Por favor, escribe tu consulta.")
      setStatus("error")
      return
    }

    setStatus("loading")
    setErrorMsg("")

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          mode,
          message: mode === "contact" ? message.trim() : undefined,
        }),
      })

      if (res.ok) {
        setStatus("success")
        track(mode === "contact" ? "contact_success" : "subscribe_success")
      } else {
        const data = (await res.json()) as { error?: string }
        setErrorMsg(data.error ?? "Algo salió mal. Inténtalo de nuevo.")
        setStatus("error")
      }
    } catch {
      setErrorMsg("Error de conexión. Inténtalo de nuevo.")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex flex-col items-center gap-2 text-center"
      >
        <p className="text-lg font-medium text-white">
          {mode === "contact" ? "¡Recibido! Te respondemos pronto." : "¡Gracias! Te avisaremos pronto."}
        </p>
        <p className="text-sm text-white/60">
          {mode === "contact"
            ? "Hemos recibido tu consulta. En breve nos ponemos en contacto contigo."
            : "Estás apuntado. Te avisamos en cuanto estemos listos."}
        </p>
      </motion.div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">

      {/* ── Mode toggle ── */}
      <div className="flex rounded-full border border-white/12 bg-[rgba(6,18,30,0.45)] p-1 backdrop-blur-md">
        {(["subscribe", "contact"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            className={`relative rounded-full px-5 py-1.5 text-xs font-medium transition-colors duration-150 ${
              mode === m ? "text-[#06121e]" : "text-white/50 hover:text-white/80"
            }`}
          >
            {mode === m && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-white"
                transition={spring}
              />
            )}
            <span className="relative z-10">
              {m === "subscribe" ? "Novedades y tarifas" : "Contactar"}
            </span>
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full"
        aria-label={mode === "contact" ? "Formulario de contacto" : "Formulario de suscripción"}
        noValidate
      >
        {/*
          Architecture to avoid lag:
          - Outer motion.div handles shape/size via `layout` (transform-based, GPU only).
            backdrop-blur is NOT here — blur on a scaling element is expensive.
          - Inner absolute div carries the blur & background. It stays static size
            and is clipped by the parent's overflow:hidden.
          - Content cross-fades with opacity only (cheapest GPU op) via AnimatePresence.
        */}
        <motion.div
          layout
          transition={spring}
          className="relative w-full overflow-hidden border border-white/12"
          style={{ borderRadius: 16, willChange: "transform" }}
        >
          {/* Static blur layer — not animated, so no per-frame blur repaint */}
          <div className="pointer-events-none absolute inset-0 bg-[rgba(6,18,30,0.45)] backdrop-blur-md" />

          {/* Content — opacity-only cross-fade, fastest possible */}
          <div className="relative">
            <AnimatePresence mode="wait" initial={false}>
              {mode === "subscribe" ? (
                <motion.div
                  key="subscribe"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="flex w-full items-center p-1.5"
                >
                  <label htmlFor="email-subscribe" className="sr-only">Tu dirección de email</label>
                  <input
                    id="email-subscribe"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError() }}
                    placeholder="Tu email"
                    className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    disabled={status === "loading"}
                    aria-required="true"
                    aria-invalid={status === "error"}
                    aria-describedby={status === "error" ? "form-error" : undefined}
                    autoComplete="email"
                    inputMode="email"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    aria-label="Suscribirme"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#06121e] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
                  >
                    {status === "loading"
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <ArrowRight className="h-4 w-4" />}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="contact"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="flex w-full flex-col"
                >
                  <label htmlFor="email-contact" className="sr-only">Tu dirección de email</label>
                  <input
                    id="email-contact"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError() }}
                    placeholder="Tu email"
                    className="w-full bg-transparent px-5 py-3.5 text-sm text-white placeholder:text-white/40 focus:outline-none border-b border-white/10"
                    disabled={status === "loading"}
                    aria-required="true"
                    aria-invalid={status === "error"}
                    aria-describedby={status === "error" ? "form-error" : undefined}
                    autoComplete="email"
                    inputMode="email"
                  />
                  <label htmlFor="message-contact" className="sr-only">Tu consulta</label>
                  <textarea
                    id="message-contact"
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); clearError() }}
                    placeholder="¿En qué podemos ayudarte?"
                    rows={4}
                    className="w-full resize-none bg-transparent px-5 py-3.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    disabled={status === "loading"}
                    aria-required="true"
                  />
                  <div className="px-3 pb-3">
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-medium text-[#06121e] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
                    >
                      {status === "loading"
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                        : "Enviar consulta"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence>
          {status === "error" && errorMsg && (
            <motion.p
              id="form-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="mt-2 text-center text-sm text-red-300"
            >
              {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </form>
    </div>
  )
}
