'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import type { BarcodeResult } from '@/types'

interface BarcodeScannerProps {
  onResult: (result: BarcodeResult) => void
  onClose: () => void
}

// BarcodeScanner uses the browser's MediaDevices API to access the camera
// and zxing-wasm to decode barcodes from the video stream.
// zxing is loaded dynamically to avoid SSR issues.
export default function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>()
  const stoppedRef = useRef(false)
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)
  const lastScanRef = useRef<string | null>(null)

  // Kill camera + decode loop immediately
  const cleanup = useCallback(() => {
    stoppedRef.current = true
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  // Start the camera stream
  const startCamera = useCallback(async () => {
    if (stoppedRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsReady(true)
        startScanning()
      }
    } catch (err) {
      console.error('Camera error:', err)
      setHasError(true)
      toast.error('Could not access camera')
    }
  }, [])

  // Continuously capture frames and attempt barcode decode
  const startScanning = useCallback(async () => {
    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    const reader = new BrowserMultiFormatReader()

    const decode = () => {
      if (stoppedRef.current || !videoRef.current || !canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      ctx.drawImage(videoRef.current, 0, 0)

      try {
        const result = reader.decodeFromCanvas(canvas)
        if (result) {
          const barcode = result.getText()

          if (barcode !== lastScanRef.current) {
            lastScanRef.current = barcode
            handleBarcodeFound(barcode)
            return
          }
        }
      } catch {
        // zxing throws NotFoundException if no barcode in frame — normal
      }

      if (!stoppedRef.current) {
        animFrameRef.current = requestAnimationFrame(decode)
      }
    }

    if (!stoppedRef.current) {
      animFrameRef.current = requestAnimationFrame(decode)
    }
  }, [])

  const handleBarcodeFound = async (barcode: string) => {
    cleanup()
    toast.loading('Looking up product...')

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    })

    toast.dismiss()
    const data = await res.json()

    onResult({
      barcode,
      product: data.found ? data.product : undefined,
    })
  }

  const handleClose = () => {
    cleanup()
    onClose()
  }

  // Cleanup on unmount
  useEffect(() => {
    stoppedRef.current = false
    startCamera()
    return cleanup
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white backdrop-blur-sm"
      >
        <X size={20} />
      </button>

      {/* The video stream */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Off-screen canvas for zxing decoding */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Darkened corners */}
            <div className="absolute inset-0 bg-black/40" />

            {/* The scanning window cutout */}
            <div className="relative w-72 h-48 z-10">
              {/* Corner markers */}
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-6 h-6 border-green-400 ${cls}`} />
              ))}

              {/* Animated scan line */}
              <div
                className="scan-line absolute left-0 right-0 h-0.5 bg-green-400/80"
                style={{ boxShadow: '0 0 8px #4ade80' }}
              />
            </div>
          </div>
        )}

        {/* Status message */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          {!isReady && !hasError && (
            <div className="bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
              Starting camera...
            </div>
          )}
          {isReady && (
            <div className="bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              Point at a barcode
            </div>
          )}
          {hasError && (
            <div className="bg-red-900/80 backdrop-blur-sm text-red-200 text-sm px-4 py-2 rounded-full">
              Camera unavailable
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
