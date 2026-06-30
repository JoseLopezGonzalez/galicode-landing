'use client'

import { useEffect, useRef } from 'react'

// ── GLSL ES 1.00 — fullscreen quad vertex shader ──────────────────────────────
const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

// ── GLSL ES 1.00 — realistic ocean caustics, zenith view ──────────────────────
// Layers: (1) domain-warped FBM = deep-water currents / depth variation
//         (2) iterative caustic field = sharp refracted light veins (pool-from-above)
//         (3) chromatic dispersion + specular sparkle = modern, photographic feel
// Palette: dark marine (#06121e) → teal (#1e8aaa), copper glint at the brightest peaks
const FRAG = `
precision highp float;
uniform float uTime;
uniform vec2  uRes;

#define TAU 6.28318530718

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(
    mix(dot(hash2(i),           f),           dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
    mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)), dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v=0.0, a=0.5;
  mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<6;i++){v+=a*gnoise(p);p=m*p;a*=0.5;}
  return v;
}

// Slow large-scale currents (depth / colour variation under the surface)
float currents(vec2 p, float t) {
  vec2 q=vec2(fbm(p+t*0.06), fbm(p+vec2(5.2,1.3)+t*0.06));
  vec2 r=vec2(fbm(p+2.0*q+vec2(1.7,9.2)+t*0.04),
              fbm(p+2.0*q+vec2(8.3,2.8)+t*0.04));
  return fbm(p+2.4*r)*0.5+0.5;
}

// Classic iterative water caustics — the recognisable "pool seen from above" veins.
// Each iteration distorts a tiled domain and accumulates inverse-distance brightness.
float caustic(vec2 uv, float time) {
  vec2 p = mod(uv * TAU, TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.0045;
  for (int n = 0; n < 6; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y),
                 sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten),
                           p.y / (cos(i.y + t) / inten)));
  }
  c /= 6.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}

vec3 palette(float t) {
  t=clamp(t,0.0,1.0);
  vec3 a=vec3(0.016,0.055,0.094); // #04101a deepest
  vec3 b=vec3(0.027,0.118,0.188); // #071e30 abyss
  vec3 c=vec3(0.039,0.220,0.337); // #0a3856 petrol
  vec3 d=vec3(0.055,0.388,0.541); // #0e638a teal
  vec3 e=vec3(0.157,0.620,0.741); // #289ebd bright crest
  vec3 col=mix(a,b,smoothstep(0.00,0.30,t));
  col=mix(col,c,smoothstep(0.30,0.55,t));
  col=mix(col,d,smoothstep(0.55,0.80,t));
  col=mix(col,e,smoothstep(0.80,1.00,t));
  return col;
}

// Seabed: rocky / sandy substrate glimpsed through the water — mottled, warm-tinted.
// Drifts very slowly; only shows through where the water is darker (shallower light).
vec3 seabed(vec2 p, float t) {
  vec2 q = p*1.1 + vec2(t*0.008, t*0.004);
  float rock  = fbm(q*2.2);            // medium rock clusters
  float grain = fbm(q*8.0)*0.5+0.5;    // fine sand grain
  float patch = fbm(q*0.7)*0.5+0.5;    // large rock/sand patches
  float bed   = clamp(rock*0.6+0.5,0.0,1.0);
  vec3 wetSand = vec3(0.165,0.140,0.092); // dark wet sand
  vec3 rockGrn = vec3(0.062,0.105,0.090); // greenish rock
  vec3 algae   = vec3(0.050,0.135,0.100); // algae / weed tint
  vec3 c = mix(rockGrn, wetSand, smoothstep(0.40,0.78,patch));
  c = mix(c, algae, smoothstep(0.55,0.95,grain)*0.45);
  c *= 0.75 + 0.5*bed;                  // subtle light/dark mottling
  return c;
}

// Sea foam: thin wispy bright streaks drifting on the surface — patchy, not uniform.
float foam(vec2 p, float t) {
  vec2 q = p*1.4 + vec2(t*0.025, t*0.012);
  float ridge = fbm(q*2.6 + fbm(q*1.3));  // domain-warped field
  ridge = 1.0 - abs(ridge)*2.4;           // bright where field crosses zero
  ridge = clamp(ridge, 0.0, 1.0);
  ridge = pow(ridge, 2.5);                // thin the streaks
  float mask = smoothstep(0.50, 0.92, fbm(q*0.6 + t*0.015)*0.5+0.5);
  return ridge * mask;                    // foam only in scattered patches
}

void main() {
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime;

  // ── Base layer: deep-water depth/colour from slow currents ────────────────
  vec2 pc = p*2.0;
  float depth = currents(pc, t);

  // ── Caustic coordinate: warp the sampling domain with the currents so the
  //    light veins drift organically with the water (not a rigid grid) ───────
  vec2 cuv = uv*vec2(uRes.x/uRes.y,1.0)*1.6;
  cuv += 0.18*vec2(fbm(pc*1.5+t*0.05), fbm(pc*1.5+vec2(3.1,7.7)+t*0.05));
  float ct = t*0.18 + 23.0;

  // ── Chromatic dispersion: sample caustics at 3 slightly offset scales for
  //    a subtle prismatic edge on the brightest veins (modern, photographic) ─
  float cr = caustic(cuv*1.005, ct);
  float cg = caustic(cuv,       ct);
  float cb = caustic(cuv*0.995, ct);
  float caust = (cr+cg+cb)/3.0;

  // ── Seabed substrate (rock/sand) — sits beneath the water column ──────────
  vec3 bed = seabed(p*2.0, t);

  // Base water colour driven by depth + a lift from the caustic field
  vec3 water = palette(depth*0.55 + caust*0.55);

  // Turbidity: sea water is murkier than a pool — let the bottom show through
  // most in the darker/shallower patches, and tint the whole column greener.
  float clarity = smoothstep(0.15, 0.75, depth*0.6 + caust*0.7);
  vec3 col = mix(bed, water, clarity);
  col = mix(col, col*vec3(0.86,1.04,0.96), 0.35); // subtle green-sea cast

  // Add the refracted light as additive teal-white glow with chromatic tint.
  // Attenuate the glow where the seabed dominates (light scatters in murk).
  vec3 causticGlow = vec3(cr*0.55, cg*0.85, cb*1.0);
  col += causticGlow * 0.78 * (0.4 + 0.6*clarity);

  // ── Sea foam — drifting bright streaks on the surface ─────────────────────
  float fm = foam(p*2.0, t);
  vec3 foamCol = vec3(0.78,0.88,0.90);            // cool off-white
  col = mix(col, foamCol, fm*0.55);

  // Warm copper sparkle only on the very brightest crests (≤ design-system spirit)
  float spark = smoothstep(0.72, 1.0, caust);
  col += vec3(0.45,0.22,0.08) * spark * 0.26;

  // Gentle vignette in-shader to seat the content (UI overlay adds the rest)
  col *= 1.0 - 0.35*pow(length(p*vec2(0.9,1.0)), 2.2);

  // Subtle filmic tone curve for richer, less flat output
  col = col/(col+vec3(0.85)) * 1.35;

  gl_FragColor=vec4(col,1.0);
}
`

// ── WebGL helpers ─────────────────────────────────────────────────────────────
function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile error')
  return sh
}

function buildProgram(gl: WebGLRenderingContext): WebGLProgram {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? 'link error')
  return prog
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OceanShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const gl = (
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    ) as WebGLRenderingContext | null
    if (!gl) return

    let prog: WebGLProgram
    try {
      prog = buildProgram(gl)
    } catch (err) {
      console.warn('[OceanShader]', err)
      return
    }

    gl.useProgram(prog)

    // Fullscreen quad: two triangles in clip space
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uRes  = gl.getUniformLocation(prog, 'uRes')

    const resize = () => {
      // Cap at 2× DPR for performance; shader is soft so upscaling looks fine
      const dpr = Math.min(devicePixelRatio, 2)
      canvas.width  = Math.round(window.innerWidth  * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    window.addEventListener('resize', resize)
    resize()

    let rafId = 0
    let paused = false
    const t0 = performance.now()

    const onVisibility = () => { paused = document.hidden }
    document.addEventListener('visibilitychange', onVisibility)

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      if (paused) return
      gl.uniform1f(uTime, (performance.now() - t0) / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    tick()

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return (
    <>
      <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundColor: '#06121e',
      }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        {/* contrast overlay — keeps text WCAG AA over the brightest caustic veins */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:'radial-gradient(ellipse at center, rgba(6,18,30,0.25) 0%, rgba(6,18,30,0.10) 45%, rgba(6,18,30,0.35) 100%)' }} />
      </div>
    </>
  )
}
