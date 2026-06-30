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
uniform vec2  uMouse;  // pointer pos in aspect-corrected centred space; offscreen until moved
uniform sampler2D uTex; // real seabed photo
uniform float uHasTex;  // 1.0 once the seabed texture has loaded, else 0.0
uniform vec2  uTexRes;  // seabed image pixel size (for cover-fit)

#define TAU 6.28318530718

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}

// Scalar hash for film grain (Dave Hoskins hash12)
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(
    mix(dot(hash2(i),           f),           dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
    mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)), dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x),
    u.y);
}

const mat2 ROT = mat2(1.6,1.2,-1.2,1.6);
float fbm5(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*gnoise(p);p=ROT*p;a*=0.5;}return v;}
float fbm3(vec2 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*gnoise(p);p=ROT*p;a*=0.5;}return v;}

// Slow large-scale currents (depth / colour variation under the surface)
float currents(vec2 p, float t) {
  vec2 q=vec2(fbm5(p+t*0.06), fbm5(p+vec2(5.2,1.3)+t*0.06));
  vec2 r=vec2(fbm5(p+2.0*q+vec2(1.7,9.2)+t*0.04),
              fbm5(p+2.0*q+vec2(8.3,2.8)+t*0.04));
  return fbm5(p+2.4*r)*0.5+0.5;
}

// Surface elevation field — drives normals (lighting), specular glints and foam crests
float waveHeight(vec2 p, float t) {
  float h = fbm3(p*1.4 + vec2(t*0.08, t*0.05) + fbm3(p*0.8 - t*0.03));
  return h*0.5+0.5;
}

// Surface normal via finite differences of the height field
vec3 surfaceNormal(vec2 p, float t) {
  float e=0.012;
  float hL=waveHeight(p-vec2(e,0.0),t);
  float hR=waveHeight(p+vec2(e,0.0),t);
  float hD=waveHeight(p-vec2(0.0,e),t);
  float hU=waveHeight(p+vec2(0.0,e),t);
  return normalize(vec3(hL-hR, hD-hU, e*4.0));
}

// Iterative water caustics — recognisable "pool seen from above" veins.
// mod() gives the crisp, well-formed vein shapes. The CALLER breaks any visible
// tiling by phase-shifting the input with low-frequency warp + scale variation,
// which displaces each repeat differently without smearing the shapes.
float caustic(vec2 uv, float time) {
  vec2 p = mod(uv * TAU, TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.0045;
  for (int n = 0; n < 5; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y),
                 sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten),
                           p.y / (cos(i.y + t) / inten)));
  }
  c /= 5.0;
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
  float rock  = fbm3(q*2.2);            // medium rock clusters
  float grain = fbm3(q*8.0)*0.5+0.5;    // fine sand grain
  float patch = fbm3(q*0.7)*0.5+0.5;    // large rock/sand patches
  float bed   = clamp(rock*0.6+0.5,0.0,1.0);
  vec3 wetSand = vec3(0.165,0.140,0.092); // dark wet sand
  vec3 rockGrn = vec3(0.062,0.105,0.090); // greenish rock
  vec3 algae   = vec3(0.050,0.135,0.100); // algae / weed tint
  vec3 c = mix(rockGrn, wetSand, smoothstep(0.40,0.78,patch));
  c = mix(c, algae, smoothstep(0.55,0.95,grain)*0.45);
  c *= 0.75 + 0.5*bed;                  // subtle light/dark mottling
  return c;
}

// Real seabed photo, cover-fitted to the screen and refracted by the water.
// 'refract' is a small UV offset (from surface normal) so the bottom ripples.
vec3 seabedPhoto(vec2 uv, vec2 refract) {
  // cover-fit: scale the image to fill the screen without distortion
  float scrA = uRes.x / uRes.y;
  float texA = uTexRes.x / uTexRes.y;
  vec2 st = uv;
  if (scrA > texA) {            // screen wider than image → fit width, crop height
    st.y = (uv.y - 0.5) * (texA / scrA) + 0.5;
  } else {                      // screen taller → fit height, crop width
    st.x = (uv.x - 0.5) * (scrA / texA) + 0.5;
  }
  st += refract;
  return texture2D(uTex, clamp(st, 0.001, 0.999)).rgb;
}

// Sea foam: thin wispy bright streaks drifting on the surface — patchy, not uniform.
float foam(vec2 p, float t) {
  vec2 q = p*1.4 + vec2(t*0.025, t*0.012);
  float ridge = fbm3(q*2.6 + fbm3(q*1.3)); // domain-warped field
  ridge = 1.0 - abs(ridge)*2.4;            // bright where field crosses zero
  ridge = clamp(ridge, 0.0, 1.0);
  ridge = pow(ridge, 2.5);                 // thin the streaks
  float mask = smoothstep(0.50, 0.92, fbm3(q*0.6 + t*0.015)*0.5+0.5);
  return ridge * mask;                     // foam only in scattered patches
}

void main() {
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y;
  vec2 p=(uv-0.5)*vec2(asp,1.0);
  float t=uTime;

  // ── (6) Slow camera drift — the dron breathes, breaking the loop feel ─────
  vec2 drift = vec2(sin(t*0.015), cos(t*0.012)) * 0.035;

  // ── (8) Pointer interaction — a decaying ripple where the cursor touches ──
  vec2 toM = p - uMouse;
  float dM = length(toM);
  float ripple = sin(dM*20.0 - t*3.2) * exp(-dM*5.0) * 0.012;
  vec2 warpOff = drift + normalize(toM + 1e-5) * ripple;

  p += warpOff;
  uv += warpOff / vec2(asp,1.0);

  // ── Base layer: deep-water depth/colour from slow currents ────────────────
  vec2 pc = p*2.0;
  float depth = currents(pc, t);

  // ── (3) Bathymetry — large slow field: shallows (turquoise) vs deep (dark) ─
  float bathy = fbm3(p*0.45 + vec2(t*0.012, 0.0))*0.5+0.5;

  // ── (1) Surface normal + sun direction → coherent lighting ────────────────
  vec3 n = surfaceNormal(p*2.0, t);
  vec3 L = normalize(vec3(-0.55, 0.50, 0.72)); // sun, upper-left
  vec3 V = vec3(0.0, 0.0, 1.0);                // zenith view
  vec3 Hh = normalize(L + V);
  float ndl = clamp(dot(n, L)*0.5 + 0.5, 0.0, 1.0);

  // ── Caustic coordinate — crisp veins (mod) with the tiling fully broken ───
  // The mod() tile repeats every ~1.0 in cuv space. To destroy any visible
  // repetition we displace the domain by MORE than a full tile, with detail at
  // roughly the repeat frequency, so every repeat lands somewhere different.
  vec2 cuv = uv*vec2(asp,1.0)*1.6;

  // (b) two-octave domain warp, amplitude ~0.8 tile → neighbouring repeats decorrelate
  vec2 w  = vec2(fbm3(pc*0.9 + t*0.03),
                 fbm3(pc*0.9 + vec2(11.0,5.0) + t*0.03));
  w      += 0.5*vec2(fbm3(pc*1.9 - t*0.02),
                     fbm3(pc*1.9 + vec2(4.0,9.0) - t*0.02));
  cuv    += 0.80 * w;

  // (c) spatial scale variation → cell size drifts, no uniform grid
  cuv *= 1.0 + 0.25*fbm3(pc*0.5 + 3.0);

  // (d) gentle per-region rotation → further decorrelates the tile orientation
  float ang = 0.6*fbm3(pc*0.4 + 10.0);
  float sa = sin(ang), ca = cos(ang);
  cuv = mat2(ca,-sa,sa,ca) * cuv;

  float ct = t*0.18 + 23.0;

  // (e) chromatic dispersion → prismatic vein edges
  float cr = caustic(cuv*1.006, ct);
  float cg = caustic(cuv,       ct);
  float cb = caustic(cuv*0.994, ct);
  float caust = (cr+cg+cb)/3.0;

  // ── Seabed substrate — real photo (refracted) when loaded, else procedural ─
  // Refraction: offset the lookup by the surface slope + a slow ripple, so the
  // bottom wobbles as if seen through moving water.
  vec2 refr = -n.xy * 0.020
            + 0.007*vec2(fbm3(pc*1.2 + t*0.05),
                         fbm3(pc*1.2 + 7.0 + t*0.05));
  vec3 bed = mix(seabed(p*2.0, t), seabedPhoto(uv, refr), uHasTex);
  // Caustic light pools on the rock/sand (physically the veins fall on the bed)
  bed *= 0.80 + 0.75*caust;

  // Base water colour: depth + caustic lift + a little from the shallows
  float waterT = depth*0.42 + caust*0.42 + bathy*0.18;
  vec3 water = palette(clamp(waterT, 0.0, 1.0));
  // (3) gentle turquoise tint over the shallow banks (kept subtle)
  water = mix(water, water*vec3(0.78,1.12,1.06)+vec3(0.0,0.02,0.03),
              smoothstep(0.60,0.95,bathy)*0.32);

  // (3) Turbidity tied to depth: bottom shows most in dark/shallow patches
  float clarity = smoothstep(0.10, 0.70, depth*0.4 + caust*0.6 + bathy*0.4);
  vec3 col = mix(bed, water, clarity);
  col = mix(col, col*vec3(0.86,1.04,0.96), 0.30); // green-sea cast

  // Refracted light as additive teal-white glow, attenuated in the murk
  vec3 causticGlow = vec3(cr*0.55, cg*0.85, cb*1.0);
  col += causticGlow * 0.42 * (0.4 + 0.6*clarity);

  // ── (1) Apply sun-driven shading to the whole column (subtle, keeps depth) ─
  col *= 0.82 + 0.26*ndl;

  // ── (2) Specular glints — sun reflecting off micro-ripples (surface light) ─
  float spec = pow(max(dot(n, Hh), 0.0), 56.0);
  float sparkleGate = smoothstep(0.62, 0.95, fbm3(p*16.0 + t*0.4)*0.5+0.5);
  spec *= 0.55 + 0.8*sparkleGate;
  col += vec3(0.85,0.93,1.0) * spec * 0.55 * clarity;

  // ── (4) Sea foam — born on wave crests, dissolving over time ──────────────
  float crest = smoothstep(0.62, 0.92, waveHeight(p*2.0, t));
  float wisp  = foam(p*2.0, t);
  float dissolve = smoothstep(0.30, 0.72, fbm3(p*3.0 + t*0.22)*0.5+0.5);
  float fm = clamp(max(wisp, crest*0.7) * dissolve, 0.0, 1.0);
  vec3 foamCol = vec3(0.80,0.89,0.92);
  col = mix(col, foamCol, fm*0.5);

  // ── (7) Copper bioluminescence — sparse warm glints in the dark deep water ─
  float bioField = fbm3(p*7.0 - vec2(t*0.08, t*0.05))*0.5+0.5;
  float bio = smoothstep(0.86, 0.99, bioField) * smoothstep(0.55, 0.05, waterT);
  col += vec3(0.62,0.30,0.10) * bio * 0.55;

  // Vignette to seat the content
  col *= 1.0 - 0.35*pow(length(p*vec2(0.9,1.0)), 2.2);

  // Filmic tone curve for richer, less flat output
  col = col/(col+vec3(0.92)) * 1.28;

  // ── (5) Film grain / dither — kills banding, adds editorial finish ────────
  float g = hash12(gl_FragCoord.xy + fract(t)*137.0);
  col += (g - 0.5) * 0.028;

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

    const uTime   = gl.getUniformLocation(prog, 'uTime')
    const uRes    = gl.getUniformLocation(prog, 'uRes')
    const uMouse  = gl.getUniformLocation(prog, 'uMouse')
    const uTexU   = gl.getUniformLocation(prog, 'uTex')
    const uHasTex = gl.getUniformLocation(prog, 'uHasTex')
    const uTexRes = gl.getUniformLocation(prog, 'uTexRes')

    // ── Seabed photo as a WebGL texture (subtle, refracted under the water) ──
    let disposed = false
    gl.uniform1f(uHasTex, 0)
    gl.uniform2f(uTexRes, 1, 1)
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    // 1×1 dark placeholder until the image decodes (avoids a flash)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([6, 18, 30, 255]))
    gl.uniform1i(uTexU, 0)
    const img = new Image()
    img.onload = () => {
      if (disposed) return
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      // Non-power-of-2 safe params: clamp + linear, no mipmaps
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.uniform2f(uTexRes, img.naturalWidth, img.naturalHeight)
      gl.uniform1f(uHasTex, 1)
    }
    img.src = '/seabed.png'

    let aspect = 1
    const resize = () => {
      // Cap DPR for performance; shader is soft so mild upscaling looks fine
      const dpr = Math.min(devicePixelRatio, 1.75)
      canvas.width  = Math.round(window.innerWidth  * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      aspect = canvas.width / canvas.height
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    window.addEventListener('resize', resize)
    resize()

    // Pointer ripple — target updated on move, smoothed each frame.
    // Start offscreen so there's no ripple until the user actually moves.
    const target = { x: -10, y: -10 }
    const smooth = { x: -10, y: -10 }
    const onPointerMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth
      const ny = e.clientY / window.innerHeight
      target.x = (nx - 0.5) * aspect
      target.y = 0.5 - ny // flip Y to match shader space
    }
    const onPointerLeave = () => { target.x = -10; target.y = -10 }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)

    let rafId = 0
    let paused = false
    const t0 = performance.now()

    const onVisibility = () => { paused = document.hidden }
    document.addEventListener('visibilitychange', onVisibility)

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      if (paused) return
      smooth.x += (target.x - smooth.x) * 0.06
      smooth.y += (target.y - smooth.y) * 0.06
      gl.uniform2f(uMouse, smooth.x, smooth.y)
      gl.uniform1f(uTime, (performance.now() - t0) / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      gl.deleteBuffer(buf)
      gl.deleteTexture(tex)
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
