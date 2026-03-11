'use client'

import { useCallback, useState, useRef } from 'react'
import { usePantryStore } from '@/lib/stores/pantry'
import toast from 'react-hot-toast'

interface FullnessBarProps {
  itemId: string
  fullness: number
  interactive?: boolean
}

export default function FullnessBar({ itemId, fullness, interactive = false }: FullnessBarProps) {
  const { updateFullness } = usePantryStore()
  const [localFullness, setLocalFullness] = useState(fullness)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const getColor = (f: number) => {
    if (f > 0.5) return '#16a34a'  // success green
    if (f > 0.2) return '#d97706'  // warning amber
    return '#dc2626'               // error red
  }

  const toFullness = useCallback((clientX: number) => {
    if (!trackRef.current) return 0
    const r = trackRef.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }, [])

  const onDown = (e: React.PointerEvent) => {
    if (!interactive) return
    setIsDragging(true)
    setLocalFullness(toFullness(e.clientX))
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!isDragging || !interactive) return
    setLocalFullness(toFullness(e.clientX))
  }

  const onUp = async (e: React.PointerEvent) => {
    if (!isDragging || !interactive) return
    setIsDragging(false)
    const f = toFullness(e.clientX)
    setLocalFullness(f)
    await updateFullness(itemId, f)
    toast.success(`Updated to ${Math.ceil(f * 100)}%`)
  }

  const d = isDragging ? localFullness : fullness
  const color = getColor(d)

  return (
    <div className="space-y-1">
      <div
        ref={trackRef}
        className={`relative h-1.5 bg-base-300 rounded-full overflow-hidden ${interactive ? 'cursor-ew-resize' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full fullness-bar-fill"
          style={{ width: `${d * 100}%`, backgroundColor: color }}
        />
        {interactive && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow transition-opacity"
            style={{ left: `calc(${d * 100}% - 6px)`, backgroundColor: color, opacity: isDragging ? 1 : 0 }}
          />
        )}
      </div>
      {interactive && isDragging && (
        <p className="text-[10px] font-mono text-right" style={{ color }}>
          {Math.ceil(d * 100)}%
        </p>
      )}
    </div>
  )
}
