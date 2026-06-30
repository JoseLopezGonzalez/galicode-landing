---
name: visual-reviewer
description: Revisa contraste, responsive y performance del fondo WebGL shader en la landing de Galicode
---

# Visual Reviewer — Galicode Landing

## Qué revisar

### 1. Contraste de texto (WCAG AA mínimo)
- Texto blanco (#ffffff) sobre fondos oscuros: ratio mínimo 4.5:1 (texto normal), 3:1 (texto grande)
- El shader varía dinámicamente: el overlay `rgba(6,18,30,0.38)` entre canvas y contenido garantiza contraste en todos los estados
- El azul profundo #06121e tiene luminancia ≈ 0.006 → blanco puro ratio ≈ 18:1 ✓
- Zona más brillante (caustics peak + teal #0f3d4d) tiene luminancia ≈ 0.018 → ratio blanco ≈ 12:1 ✓
- Herramienta: `contrast-ratio.com` o calcular: (L1 + 0.05) / (L2 + 0.05)

### 2. Responsive (mobile-first, 360px → ultrawide)
Verificar en estas anchuras:
- 360px (Android gama media)
- 390px (iPhone 14)
- 768px (tablet)
- 1280px (laptop)
- 1920px (desktop full HD)
- 2560px+ (ultrawide)

Puntos críticos:
- El formulario de email: `w-full max-w-md` con padding lateral en móvil
- El heading: `clamp()` debe mantenerse legible sin overflow
- El canvas WebGL: ajusta resolución via `uRes` uniform; escala CSS a `100%` del viewport
- El footer legal: texto muy pequeño, verificar legibilidad en móvil

### 3. Performance del shader WebGL
Verificaciones específicas de WebGL (en DevTools → Performance y Rendering):
- **FPS**: debe mantenerse en 60fps en gama media (4 cores, iGPU); aceptable 30fps en gama baja
- **GPU usage**: el shader de fondo no debe superar el 30% de GPU en reposo en gama media
- **DPR cap**: verificar que `canvas.width ≤ window.innerWidth * 2` (hardcap en devicePixelRatio 2×)
- **Visibilitychange**: con la pestaña oculta el RAF debe pausarse — verificar en DevTools Timeline que no hay frames renderizados
- **Jank en scroll**: el canvas es `position: fixed` sin dependencia de scroll, no debe causar composite layers adicionales
- Verificar ausencia de `console.warn('[OceanShader]')` en producción (indicaría fallo de compilación GLSL)

### 4. Fallbacks
- Activar `prefers-reduced-motion: reduce` en DevTools → Rendering → verificar que el canvas queda transparente y el fondo base `#06121e` es visible
- Desactivar WebGL en `chrome://flags` (o usar un perfil sin GPU) → verificar que el `div` base oscuro muestra como fondo estático sin errores JS
- El componente se carga con `dynamic(ssr: false)` → el HTML inicial nunca incluye el canvas, no hay errores de hidratación

### 5. Accesibilidad adicional
- Input con `id` + `<label htmlFor>` o `aria-label`
- Botón submit con texto descriptivo o `aria-label`
- Focus visible en todos los elementos interactivos
- No depender solo del color para comunicar estados (success/error)
- Canvas tiene `aria-hidden="true"` (correcto — es decorativo)

## Criterios bloqueantes (deben corregirse antes de dar por válido)
1. Contraste < AA en cualquier estado del texto visible
2. Formulario inutilizable en 360px
3. Shader causando jank visible (FPS < 20) en hardware de gama media con CPU throttle 4×
4. `console.error` o crash de WebGL en producción
5. Input sin label accesible
6. Ausencia de estado visible de focus
7. Fallback `prefers-reduced-motion` no funciona (canvas sigue animando)

## Criterios no bloqueantes (documentar, resolver en siguiente iteración)
- Lighthouse Performance < 90 en móvil (el canvas WebGL puede costar 5-10 puntos en TBT)
- GPU usage > 30% en gama media (considerar reducir octavas FBM de 5 a 4 o bajar DPR cap a 1.5×)
- Sin FOUT durante carga diferida del canvas (añadir `onLoad` fade-in si se percibe flash)
