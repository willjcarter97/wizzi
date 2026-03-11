'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, Camera, Loader2 } from 'lucide-react'
import { usePantryStore } from '@/lib/stores/pantry'
import toast from 'react-hot-toast'
import type { PantryLocation, PantryUnit, BarcodeResult } from '@/types'

import type { QuickResult } from '@/components/ui/BottomBar'

interface AddItemSheetProps { onClose: () => void; autoCamera?: boolean; scanResult?: BarcodeResult | null; quickResult?: QuickResult | null }

const LOCATIONS: PantryLocation[] = ['fridge', 'freezer', 'cupboard', 'counter']
const UNITS: PantryUnit[] = ['units', 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cups', 'portions']

const LOC_ACTIVE: Record<PantryLocation, string> = {
  fridge:   'btn-info',
  freezer:  'btn-primary',
  cupboard: 'btn-warning',
  counter:  'btn-secondary',
}

export default function AddItemSheet({ onClose, autoCamera = false, scanResult, quickResult }: AddItemSheetProps) {
  const { addItem } = usePantryStore()
  const [loading, setLoading]           = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [name, setName]                 = useState('')
  const [brand, setBrand]               = useState('')
  const [location, setLocation]         = useState<PantryLocation>('cupboard')
  const [quantity, setQuantity]         = useState(1)
  const [unit, setUnit]                 = useState<PantryUnit>('units')
  const [expiry, setExpiry]             = useState('')
  const [imgUrl, setImgUrl]             = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoNotes, setPhotoNotes]     = useState<string | null>(null)
  const [maxQuantity, setMaxQuantity]   = useState<number | null>(null)
  const [showCamera, setShowCamera]     = useState(false)

  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Auto-open camera if requested (from photo method in BottomBar)
  useEffect(() => {
    if (autoCamera) setShowCamera(true)
  }, [autoCamera])

  // Pre-fill form from barcode scan result
  useEffect(() => {
    if (!scanResult?.product) return
    const p = scanResult.product

    setName(p.name)
    setBrand(p.brand || '')
    setImgUrl(p.image_url || null)

    // Try to extract quantity + unit from quantity_string first, then product name as fallback
    const textToParse = p.quantity_string || p.name || ''
    const qs = textToParse.toLowerCase().trim()

    // Handle multipack first: "6 x 330ml", "24 x 330 ml"
    const multiMatch = qs.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(cl|ml|l|g|kg)\b/)
    if (multiMatch) {
      setQuantity(parseInt(multiMatch[1]))
      setMaxQuantity(parseInt(multiMatch[1]))
      setUnit('units')
    } else {
      // Single item: "500g", "1.5 kg", "330 ml", "1l", "75cl", "400 g"
      const match = qs.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|l|g|kg)\b/)
      if (match) {
        let val = parseFloat(match[1].replace(',', '.'))
        let u = match[2]
        // Convert cl → ml
        if (u === 'cl') { val *= 10; u = 'ml' }
        setQuantity(val)
        setMaxQuantity(val)
        setUnit(u as PantryUnit)
      }
    }

    // Guess storage location from categories + product name
    const allText = [...(p.categories || []), p.name || ''].join(' ').toLowerCase()
    if (/frozen|ice cream|ice-cream|gelato/.test(allText)) {
      setLocation('freezer')
    } else if (/milk|dairy|yogurt|yoghurt|cheese|cream|butter|juice|fresh|meat|chicken|fish|seafood|deli|chilled|eggs/.test(allText)) {
      setLocation('fridge')
    } else if (/bread|fruit|banana|apple|avocado|tomato|potato|onion|garlic/.test(allText)) {
      setLocation('counter')
    } else {
      setLocation('cupboard')
    }
  }, [scanResult])

  // Pre-fill form from quick AI entry
  useEffect(() => {
    if (!quickResult) return
    setName(quickResult.name)
    setBrand(quickResult.brand)
    setQuantity(quickResult.quantity)
    setMaxQuantity(quickResult.max_quantity)
    setUnit(quickResult.unit)
    setLocation(quickResult.location)
  }, [quickResult])

  // Stop camera stream whenever showCamera closes
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!showCamera) { stopCamera(); return }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch(() => {
        toast.error('Camera access denied — check browser permissions')
        setShowCamera(false)
      })

    return stopCamera
  }, [showCamera, stopCamera])

  const captureFrame = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    setShowCamera(false)
    processPhoto(dataUrl)
  }

  const processPhoto = async (dataUrl: string) => {
    setPhotoPreview(dataUrl)
    setPhotoLoading(true)
    try {
      const res = await fetch('/api/scan/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      setName(data.name || '')
      setBrand(data.brand || '')
      setLocation((data.location as PantryLocation) || 'cupboard')
      setQuantity(data.current_quantity || 1)
      setMaxQuantity(data.max_quantity || null)
      setUnit((data.unit as PantryUnit) || 'units')
      setPhotoNotes(data.notes || null)
      toast.success('Photo analysed!')
    } catch {
      toast.error("Couldn't read the photo — please fill in manually")
      setPhotoPreview(null)
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Please enter a name'); return }
    setLoading(true)
    await addItem({
      name: name.trim(), brand: brand.trim() || undefined,
      location, quantity, max_quantity: maxQuantity ?? quantity, unit,
      category: 'other', expiry_date: expiry || undefined, low_stock_threshold: 0.2,
    })
    toast.success(`Added ${name}`)
    setLoading(false)
    onClose()
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 rounded-t-3xl border-t border-base-300 p-6 pb-10 max-w-2xl mx-auto max-h-[90vh] overflow-y-auto shadow-xl"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      >
        <div className="w-10 h-1 bg-base-300 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-xl">Add item</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Barcode scan result banner */}
          {imgUrl && (
            <div className="flex items-center gap-3 p-3 bg-success/5 rounded-2xl border border-success/20">
              <img src={imgUrl} alt={name} className="w-12 h-12 rounded-xl object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-success" />
                <div>
                  <p className="text-xs font-semibold text-success">Product found</p>
                  <p className="text-xs text-base-content/40">Details filled from scan</p>
                </div>
              </div>
            </div>
          )}

          {/* Photo AI result banner */}
          {photoPreview && !photoLoading && (
            <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/20">
              <img src={photoPreview} alt="captured" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              <div className="flex items-start gap-2 min-w-0">
                <CheckCircle size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">Photo analysed</p>
                  {photoNotes && <p className="text-xs text-base-content/40 mt-0.5 line-clamp-2">{photoNotes}</p>}
                </div>
              </div>
              <button onClick={() => { setPhotoPreview(null); setPhotoNotes(null); setMaxQuantity(null) }}
                className="btn btn-ghost btn-xs btn-circle ml-auto flex-shrink-0">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Photo loading state */}
          {photoLoading && (
            <div className="flex items-center gap-3 p-3 bg-base-200 rounded-2xl border border-base-300">
              <img src={photoPreview!} alt="captured" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 opacity-60" />
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-primary animate-spin" />
                <p className="text-xs font-medium text-base-content/60">Analysing photo…</p>
              </div>
            </div>
          )}

          {/* Camera trigger (shown when no photo yet) */}
          {!photoPreview && !photoLoading && (
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="btn btn-ghost w-full rounded-2xl border border-dashed border-base-300 hover:border-primary/40 hover:bg-primary/5 h-auto py-3 gap-2"
            >
              <Camera size={16} className="text-base-content/40" />
              <span className="text-sm text-base-content/50">Take a photo to identify item</span>
            </button>
          )}

          <fieldset className="fieldset">
            <legend className="fieldset-legend text-xs">Name</legend>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Oat milk" className="input input-bordered w-full" />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend text-xs">Brand (optional)</legend>
            <input type="text" value={brand} onChange={e => setBrand(e.target.value)}
              placeholder="e.g. Oatly" className="input input-bordered w-full" />
          </fieldset>

          <div>
            <p className="fieldset-legend text-xs mb-2">Location</p>
            <div className="flex gap-2 flex-wrap">
              {LOCATIONS.map(loc => (
                <button key={loc} onClick={() => setLocation(loc)}
                  className={`btn btn-sm rounded-xl capitalize ${location === loc ? `${LOC_ACTIVE[loc]} btn-outline` : 'btn-ghost border border-base-300'}`}>
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <fieldset className="fieldset flex-1">
              <legend className="fieldset-legend text-xs">Quantity</legend>
              <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                min={0.1} step={0.1} className="input input-bordered w-full" />
            </fieldset>
            <fieldset className="fieldset flex-1">
              <legend className="fieldset-legend text-xs">Unit</legend>
              <select value={unit} onChange={e => setUnit(e.target.value as PantryUnit)} className="select select-bordered w-full">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </fieldset>
          </div>

          <fieldset className="fieldset">
            <legend className="fieldset-legend text-xs">Expiry date (optional)</legend>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
              className="input input-bordered w-full" />
          </fieldset>

          <button onClick={handleSubmit} disabled={loading || !name.trim()}
            className="btn btn-primary w-full rounded-2xl mt-2">
            {loading ? <span className="loading loading-spinner loading-sm" /> : 'Add to pantry'}
          </button>
        </div>
      </motion.div>

      {/* Camera overlay — above the sheet */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            {/* Live viewfinder */}
            <video
              ref={videoRef}
              className="flex-1 w-full object-cover"
              playsInline
              muted
            />

            {/* Controls bar */}
            <div className="flex items-center justify-between px-8 py-6 bg-black">
              <button
                onClick={() => setShowCamera(false)}
                className="btn btn-circle btn-ghost text-white border border-white/20"
              >
                <X size={20} />
              </button>

              {/* Shutter button */}
              <button
                onClick={captureFrame}
                className="w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-95 transition-transform"
              />

              {/* Spacer to balance layout */}
              <div className="w-12" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
