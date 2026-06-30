# Skill: Fluid Background — Ocean Surface WebGL Shader

## Descripción
Cómo implementar un fondo animado tipo "mar visto desde un dron" usando un **fragment shader GLSL ES 1.00 sobre WebGL puro** (sin Three.js, sin React Three Fiber — canvas WebGL nativo).

> **Historial**: La versión CSS (gradientes blob + blur) fue el punto de partida. Esta skill documenta el reemplazo definitivo: shader WebGL con FBM + domain warping + caustics.

## Cuándo usarlo
Landing pages que necesiten fondo abstracto premium con movimiento orgánico real. Ideal para:
- Temática marina/acuática/fluida
- Diseño minimalista de alto impacto visual
- Proyectos donde el bundle ya asume React (el overhead del canvas es mínimo frente al bundle)

**NO usar si**: el sitio tiene requisito de zero-JS o presupuesto de bundle extremadamente limitado — usa la versión CSS legacy en ese caso.

## Técnica

### Shader: FBM + Domain Warping + Caustics (vista cenital)

```glsl
// Vertex shader — fullscreen quad
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }

// Fragment shader — ocean surface from above
precision highp float;
uniform float uTime;
uniform vec2  uRes;
```

**Ingredientes del fragment shader:**

1. **Gradient noise** (`gnoise`) — base noise con hash de 4 esquinas, smoothstep, sin banding
2. **FBM 5 octavas** (`fbm`) — suma fractal con matriz de rotación 37° entre octavas (evita artefactos axis-aligned)
3. **Domain warping de 3 niveles** — `q = fbm(p)`, `r = fbm(p + 2q)`, `f = fbm(p + 2r)` — genera corrientes orgánicas tipo Inigo Quilez
4. **Caustics** — interferencia de 3 ondas senoidales a 120° (`0°, 120°, 240°`), elevada a `pow(2.5)` para venas brillantes sobre oscuro
5. **Paleta piecewise** — `mix` + `smoothstep` chained, sin branching GPU, mapea FBM output a colores del design-system

### Vista cenital (drone)
- No hay horizonte ni perspectiva
- UVs centrados y aspect-corrected: `(uv - 0.5) * vec2(aspect, 1.0) * zoom`
- `zoom = 3.0` → parche de superficie visible
- El patrón de caustics funciona perfectamente en 2D top-down

### Parámetros a ajustar por proyecto

| Parámetro | Rango | Galicode | Efecto |
|---|---|---|---|
| `uTime * K` | 0.008–0.025 | 0.016 | velocidad animación (0.016 → ciclo ≈ 62s) |
| zoom | 2.0–5.0 | 3.0 | campo de visión del parche marino |
| FBM octavas | 3–6 | 5 | detalle vs rendimiento |
| caust power | 1.5–4.0 | 2.5 | contraste de venas de luz |
| copper mix | 0.0–0.25 | 0.18 | acento cálido en peaks |
| DPR cap | 1.0–2.0 | 2.0 | resolución vs GPU usage |

## Estructura del componente React

```tsx
// components/ocean-shader.tsx
'use client'
import { useEffect, useRef } from 'react'

export function OceanShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // 1. Check prefers-reduced-motion → early return
    // 2. getContext('webgl') ?? getContext('experimental-webgl') → fallback si null
    // 3. compileShader + linkProgram → try/catch + console.warn si falla
    // 4. Fullscreen quad: Float32Array([-1,-1, 1,-1, -1,1, 1,1]) → TRIANGLE_STRIP
    // 5. resize(): canvas.width = innerWidth * min(dpr, 2) → uniform uRes
    // 6. tick(): requestAnimationFrame loop → uniform uTime = (now - t0) / 1000
    // 7. visibilitychange → paused flag (evita gasto de batería en background)
    // 8. cleanup: cancelAnimationFrame + removeEventListeners + deleteBuffer/Program
  }, [])

  return (
    <div aria-hidden="true" style={{ position:'fixed', inset:0, zIndex:-1, backgroundColor:'#06121e' }}>
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />
      {/* Overlay para garantizar contraste WCAG AA sobre cualquier zona del shader */}
      <div style={{ position:'absolute', inset:0, background:'rgba(6,18,30,0.38)', pointerEvents:'none' }} />
    </div>
  )
}
```

### Carga diferida en Next.js (evita bloquear FCP)

```tsx
// app/page.tsx
import dynamic from 'next/dynamic'
const OceanShader = dynamic(
  () => import('@/components/ocean-shader').then(m => ({ default: m.OceanShader })),
  { ssr: false }
)
```

## Fallbacks

| Condición | Comportamiento |
|---|---|
| `prefers-reduced-motion: reduce` | `useEffect` hace early return; canvas queda transparente; `div` base `#06121e` visible |
| WebGL no disponible (`!gl`) | mismo early return; fallback estático |
| Pestaña oculta | `document.hidden` → `paused = true` → RAF no dibuja |
| SSR | `ssr: false` en dynamic → canvas nunca renderiza en servidor |

## Fallos CSS que este enfoque resuelve

| Limitación CSS | Solución WebGL |
|---|---|
| Blur gaussiano plano, sin detalle | FBM multi-octava con detalle fractal real |
| Movimiento lineal/circular predecible | Domain warping → corrientes orgánicas impredecibles |
| Sin caustics/shimmer | Interferencia de ondas senoidales → patrón caustics real |
| No escala a resolución real (siempre "upsampled") | Canvas en píxeles reales × DPR |

## Reutilización en otros proyectos (Ocean Gate, etc.)
1. Copiar `components/ocean-shader.tsx`
2. Ajustar la función `palette()` en el fragment shader a la paleta del nuevo proyecto
3. Ajustar `uTime * K` para velocidad (más lento = más premium)
4. Ajustar `zoom` si se quiere más o menos "close-up" de la superficie
5. El overlay RGBA es independiente — ajustar opacidad según contraste necesario con el diseño

## Rendimiento
- Sin librerías adicionales — WebGL nativo (0 bytes de overhead)
- Un solo draw call por frame (`gl.drawArrays(TRIANGLE_STRIP, 0, 4)`)
- Shader de 5 octavas FBM: ~0.5ms/frame en iGPU de gama media a 1080p
- DPR cap a 2× reduce pixels a renderizar en pantallas 3× (móviles high-end)
- Pausado automático en background → 0% GPU con pestaña oculta
