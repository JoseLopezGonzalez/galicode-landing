# Design System — Galicode Landing

## Paleta de color (marina oscura)

| Token        | Valor hex | Uso |
|---|---|---|
| `deep`       | `#06121e` | Fondo base (casi negro-azul) |
| `abyss`      | `#0a1a2a` | Fondo secundario |
| `petrol`     | `#0d2d3f` | Shader gradient 1 |
| `teal`       | `#0f3d4d` | Shader gradient 2 |
| `seagreen`   | `#122b3a` | Shader gradient 3 |
| `midnight`   | `#0a2030` | Shader gradient 4 |
| `copper`     | `#3d1a10` | Acento cálido (MUY sutil, ≤18% en caustics peaks) |
| `white`      | `#ffffff` | Texto principal |
| `white-90`   | `rgba(255,255,255,0.9)` | Texto secundario |
| `white-60`   | `rgba(255,255,255,0.6)` | Texto apoyo / legal |
| `white-40`   | `rgba(255,255,255,0.4)` | Footer |
| `glass-bg`   | `rgba(6,18,30,0.4)` | Glassmorphism form background |
| `glass-border` | `rgba(255,255,255,0.12)` | Glassmorphism border |

## Tipografía

| Rol       | Fuente            | Peso  | Estilo  |
|---|---|---|---|
| Heading   | Playfair Display  | 400   | italic  |
| Body      | Inter             | 400   | normal  |
| Label/UI  | Inter             | 500   | normal  |

- CSS variable heading: `--font-display`
- CSS variable body: `--font-sans`

### Sizing del heading principal
- Desktop: `clamp(3rem, 8vw, 7rem)`
- Letter-spacing: `-0.02em`
- Color: white

## Espaciado

Máximo espacio negativo — el diseño es minimalista. Solo:
- Logo (arriba)
- Título "Próximamente"
- Formulario
- Texto de apoyo
- Footer legal (bajo opacidad)

## Principios de dirección de arte

1. **Abstracción cromática**, nunca imágenes realistas de mar
2. **Movimiento lento** — ciclo completo ≈ 62s, ease-in-out orgánico, como corrientes de tinta en agua
3. **Glassmorphism** en el formulario: `backdrop-blur` + fondo translúcido + borde sutil
4. **Contraste AA** garantizado — overlay oscuro `rgba(6,18,30,0.38)` entre el shader y el contenido
5. **Mobile-first** — el fondo WebGL escala vía `uRes` uniform; DPR cappado a 2× para rendimiento
6. **Sin ruido visual** — no hay menú, no hay secciones, no hay imágenes decorativas

## Fondo animado — WebGL shader

El fondo es un **fragment shader GLSL ES 1.00** corriendo en un canvas WebGL fullscreen (`position: fixed, inset: 0, z-index: -1`). **No es CSS**.

### Técnica (`components/ocean-shader.tsx`)
- **FBM de 5 octavas** con matriz de rotación 37° entre octavas (evita artefactos de alineación de ejes)
- **Domain warping de 3 niveles** (técnica Inigo Quilez) — genera corrientes marinas orgánicas
- **Caustics** via interferencia de 3 ondas senoidales a 120° — simula luz refractada en fondo marino
- Vista **cenital** (drone/satélite) — sin horizonte, sin perspectiva, solo patrón de superficie
- Paleta mapeada por gradiente sobre los tokens del design-system

### Parámetros clave
| Parámetro | Valor | Efecto |
|---|---|---|
| `uTime * 0.016` | escala temporal | ciclo ≈ 62s (premium, no distrae) |
| `zoom = 3.0` | campo de visión | parche de superficie visible |
| `caust power = 2.5` | exponente caustics | venas brillantes sobre base oscura |
| `copper mix ≤ 0.18` | acento cálido | solo en peaks de caustics |
| DPR cap = 2× | resolución canvas | balance calidad/rendimiento |

### Fallbacks
- `prefers-reduced-motion: reduce` → canvas no inicializa; `div` base `#06121e` visible
- WebGL no disponible → mismo `div` base oscuro como fondo estático
- Visibilidad (`document.hidden`) → `requestAnimationFrame` pausado automáticamente
- Carga diferida: `dynamic(() => import(...), { ssr: false })` — no bloquea FCP

## Theme color (barra del navegador móvil)
`#06121e` — coincide con el fondo base

## Accesibilidad
- Texto blanco sobre fondo `#06121e`: ratio ~18:1 (supera AA y AAA)
- Overlay semitransparente `rgba(6,18,30,0.38)` asegura mínimo AA sobre cualquier zona del shader
- Label `sr-only` en el input del formulario
- Focus states visibles (`outline-white/50`)
