'use client'

import { useEffect, useRef, useState } from 'react'

import { Eraser } from 'lucide-react'

// A lightweight hand-drawn signature pad (no external deps). Draws to a canvas
// and reports the PNG data URL via onChange (null when cleared/empty).
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  // Size the canvas backing store to its rendered size for crisp strokes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#111827'
    }
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    canvasRef.current?.setPointerCapture(e.pointerId)
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!dirty.current) {
      dirty.current = true
      setHasInk(true)
    }
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && dirty.current) onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="space-y-1">
      <div className="relative rounded-md border border-input bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none rounded-md"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Draw your signature here
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Eraser className="h-3 w-3" /> Clear
      </button>
    </div>
  )
}
