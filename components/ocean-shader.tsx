'use client'

import { useEffect, useRef, useState } from 'react'

// ── GLSL ES 1.00 — fullscreen quad vertex shader ──────────────────────────────
const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

// ── DIAGNOSTIC: simple sine-wave shader to confirm canvas renders ──────────────
const FRAG = `
precision mediump float;
uniform float uTime;
uniform vec2  uRes;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.8;
  float wave1 = sin(uv.x * 8.0 + t) * 0.5 + 0.5;
  float wave2 = sin(uv.y * 6.0 - t * 0.7 + 1.5) * 0.5 + 0.5;
  float v = wave1 * wave2;
  gl_FragColor = vec4(v * 0.1, v * 0.45 + 0.05, v * 0.6 + 0.05, 1.0);
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
  const [dbg, setDbg] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) { setDbg('canvas ref null'); return }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDbg('prefers-reduced-motion activo')
      return
    }

    const gl = (
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    ) as WebGLRenderingContext | null
    if (!gl) { setDbg('WebGL no disponible'); return }

    let prog: WebGLProgram
    try {
      prog = buildProgram(gl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setDbg('Shader error: ' + msg)
      console.warn('[OceanShader]', err)
      return
    }
    setDbg('WebGL OK ✓')

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
          zIndex: -1,
          backgroundColor: '#06121e',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6,18,30,0.15)',
            pointerEvents: 'none',
          }}
        />
      </div>
      {/* TEMPORARY DEBUG — remove after diagnosis */}
      <div style={{
        position: 'fixed', top: 8, right: 8,
        background: dbg?.includes('OK') ? '#0a3' : '#600',
        color: '#fff', fontSize: 13, padding: '4px 10px',
        borderRadius: 6, fontFamily: 'monospace', zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {dbg ?? 'JS: no montado aún…'}
      </div>
    </>
  )
}
