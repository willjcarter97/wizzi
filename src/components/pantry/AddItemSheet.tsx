'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera, Loader2, ChevronLeft, Plus, Check, ChevronRight, RotateCcw } from 'lucide-react'
import { usePantryStore } from '@/lib/stores/pantry'
import toast from 'react-hot-toast'
import { formatQty } from '@/lib/format'
import type { PantryLocation, PantryUnit, BarcodeResult } from '@/types'

import type { QuickResult } from '@/components/ui/BottomBar'

interface AddItemSheetProps { onClose: () => void; autoCamera?: boolean; scanResult?: BarcodeResult | null; quickResult?: QuickResult | null }

const LOCATIONS: PantryLocation[] = ['fridge', 'freezer', 'cupboard', 'spice_rack']
const UNITS: string[] = ['units', 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cups', 'portions', 'cloves']
const MAX_PHOTOS = 5

const LOC_ACTIVE: Record<PantryLocation, string> = {
  fridge:   'btn-info',
  freezer:  'btn-primary',
  cupboard: 'btn-warning',
  spice_rack: 'btn-secondary',
}

const LOC_LABELS: Record<PantryLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  cupboard: 'Cupboard',
  spice_rack: 'Spice Rack',
}

const LOC_EMOJI: Record<PantryLocation, string> = {
  fridge: '🧊',
  freezer: '❄️',
  cupboard: '🗄️',
  spice_rack: '🧂',
}

type Step = 'detect' | 'name' | 'quantity' | 'expiry' | 'location' | 'confirm' | 'done'

const STEP_ORDER: Step[] = ['detect', 'name', 'quantity', 'expiry', 'location', 'confirm']

function getStepIndex(step: Step): number {
  return STEP_ORDER.indexOf(step)
}

// ─── Scroll Quantity Picker ──────────────────────────────────────────────────

function QuantityPicker({ value, onChange, min = 0, max = 999, step = 1 }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Generate tick values
  const ticks: number[] = []
  for (let v = min; v <= max; v += step) {
    ticks.push(Math.round(v * 100) / 100)
  }

  // Find closest tick index
  const closestIdx = ticks.reduce((best, t, i) =>
    Math.abs(t - value) < Math.abs(ticks[best] - value) ? i : best, 0)

  const toValue = useCallback((clientX: number) => {
    if (!trackRef.current) return value
    const r = trackRef.current.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const idx = Math.round(pct * (ticks.length - 1))
    return ticks[idx]
  }, [ticks, value])

  const onDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    onChange(toValue(e.clientX))
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    onChange(toValue(e.clientX))
  }

  const onUp = () => {
    setIsDragging(false)
  }

  const pct = ticks.length > 1 ? (closestIdx / (ticks.length - 1)) * 100 : 50

  return (
    <div className="space-y-3">
      <div
        ref={trackRef}
        className="relative h-10 cursor-ew-resize touch-none select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-base-300 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width] duration-75"
            style={{ width: `${pct}%` }} />
        </div>
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-primary rounded-full border-3 border-white shadow-lg transition-[left] duration-75"
          style={{ left: `calc(${pct}% - 12px)` }}
        />
        {/* Min/max labels */}
        <div className="absolute -bottom-4 left-0 text-[10px] text-base-content/30 font-mono">{min}</div>
        <div className="absolute -bottom-4 right-0 text-[10px] text-base-content/30 font-mono">{max}</div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AddItemSheet({ onClose, autoCamera = false, scanResult, quickResult }: AddItemSheetProps) {
  const { addItem } = usePantryStore()

  // If we have prefilled data, skip detect and go to name for review
  const hasPrefilledData = !!(scanResult || quickResult)
  const initialStep: Step = hasPrefilledData ? 'name' : (autoCamera ? 'detect' : 'name')

  const [step, setStep]                 = useState<Step>(initialStep)
  const [direction, setDirection]       = useState(1)
  const [loading, setLoading]           = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [name, setName]                 = useState('')
  const [brand, setBrand]               = useState('')
  const [location, setLocation]         = useState<PantryLocation>('cupboard')
  const [quantity, setQuantity]         = useState(1)
  const [unit, setUnit]                 = useState<PantryUnit>('units')
  const [expiry, setExpiry]             = useState('')
  const [imgUrl, setImgUrl]             = useState<string | null>(null)
  const [photos, setPhotos]             = useState<string[]>([])
  const [photoNotes, setPhotoNotes]     = useState<string | null>(null)
  const [maxQuantity, setMaxQuantity]   = useState<number | null>(null)
  const [showCamera, setShowCamera]     = useState(false)
  // For quantity picker: determine smart max based on unit
  const [qtyMax, setQtyMax]             = useState(20)
  const [qtyStep, setQtyStep]           = useState(1)

  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Track previous unit for conversion
  const prevUnitRef = useRef(unit)

  // Smart unit conversion + range update when unit changes
  useEffect(() => {
    const prev = prevUnitRef.current
    prevUnitRef.current = unit

    // Conversions between related units
    const conversions: Record<string, Record<string, number>> = {
      g:  { kg: 0.001 },
      kg: { g: 1000 },
      ml: { l: 0.001 },
      l:  { ml: 1000 },
    }

    const factor = conversions[prev]?.[unit]
    if (factor) {
      // Related unit — convert the value
      const converted = Math.round((quantity * factor) * 100) / 100
      setQuantity(converted)
      if (maxQuantity !== null) setMaxQuantity(Math.round((maxQuantity * factor) * 100) / 100)
    } else if (prev !== unit) {
      // Unrelated unit — go to midpoint of new range
      const ranges: Record<string, { max: number; step: number }> = {
        g: { max: 2000, step: 50 }, kg: { max: 10, step: 0.5 },
        ml: { max: 3000, step: 50 }, l: { max: 10, step: 0.5 },
      }
      const r = ranges[unit] || { max: 50, step: 1 }
      setQuantity(Math.round(r.max / 2))
    }

    // Update slider range
    if (unit === 'g') { setQtyMax(2000); setQtyStep(50) }
    else if (unit === 'kg') { setQtyMax(10); setQtyStep(0.5) }
    else if (unit === 'ml') { setQtyMax(3000); setQtyStep(50) }
    else if (unit === 'l') { setQtyMax(10); setQtyStep(0.5) }
    else { setQtyMax(50); setQtyStep(1) }
  }, [unit])

  // Auto-open camera
  useEffect(() => {
    if (autoCamera && step === 'detect') setShowCamera(true)
  }, [autoCamera, step])

  // Pre-fill from barcode scan
  useEffect(() => {
    if (!scanResult?.product) return
    const p = scanResult.product
    setName(p.name)
    setBrand(p.brand || '')
    setImgUrl(p.image_url || null)

    const textToParse = p.quantity_string || p.name || ''
    const qs = textToParse.toLowerCase().trim()

    const multiMatch = qs.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(cl|ml|l|g|kg)\b/)
    if (multiMatch) {
      setQuantity(parseInt(multiMatch[1]))
      setMaxQuantity(parseInt(multiMatch[1]))
      setUnit('units')
    } else {
      const match = qs.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|l|g|kg)\b/)
      if (match) {
        let val = parseFloat(match[1].replace(',', '.'))
        let u = match[2]
        if (u === 'cl') { val *= 10; u = 'ml' }
        setQuantity(val)
        setMaxQuantity(val)
        setUnit(u as PantryUnit)
      }
    }

    const allText = [...(p.categories || []), p.name || ''].join(' ').toLowerCase()
    if (/frozen|ice cream|ice-cream|gelato/.test(allText)) setLocation('freezer')
    else if (/milk|dairy|yogurt|yoghurt|cheese|cream|butter|juice|fresh|meat|chicken|fish|seafood|deli|chilled|eggs/.test(allText)) setLocation('fridge')
    else if (/bread|fruit|banana|apple|avocado|tomato|potato|onion|garlic/.test(allText)) setLocation('spice_rack')
    else setLocation('cupboard')
  }, [scanResult])

  // Pre-fill from quick AI entry
  useEffect(() => {
    if (!quickResult) return
    setName(quickResult.name)
    setBrand(quickResult.brand)
    setQuantity(quickResult.quantity)
    setMaxQuantity(quickResult.max_quantity)
    setUnit(quickResult.unit)
    setLocation(quickResult.location)
  }, [quickResult])

  // Camera management
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
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      })
      .catch(() => { toast.error('Camera access denied'); setShowCamera(false) })
    return stopCamera
  }, [showCamera, stopCamera])

  const captureFrame = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    setPhotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.85)])
    setShowCamera(false)
  }

  const removePhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i))

  const analysePhotos = async () => {
    if (photos.length === 0) return
    setPhotoLoading(true)
    try {
      const res = await fetch('/api/scan/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: photos }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setName(data.name || '')
      setBrand(data.brand || '')
      setLocation((data.location as PantryLocation) || 'cupboard')
      setQuantity(data.current_quantity || 1)
      setMaxQuantity(data.max_quantity || null)
      setUnit(data.unit || 'units')
      setPhotoNotes(data.notes || null)
      if (data.expiry_date) setExpiry(data.expiry_date)
      toast.success('Photo analysed!')
      goToStep('name')
    } catch {
      toast.error("Couldn't read the photo — enter manually")
      goToStep('name')
    } finally {
      setPhotoLoading(false)
    }
  }

  // Navigation
  const goToStep = (next: Step) => {
    setDirection(getStepIndex(next) > getStepIndex(step) ? 1 : -1)
    setStep(next)
  }

  const nextStep = () => {
    const order: Step[] = ['name', 'quantity', 'expiry', 'location', 'confirm']
    const idx = order.indexOf(step)
    if (idx < order.length - 1) goToStep(order[idx + 1])
  }

  const prevStep = () => {
    const order: Step[] = autoCamera ? ['detect', 'name', 'quantity', 'expiry', 'location', 'confirm'] : ['name', 'quantity', 'expiry', 'location', 'confirm']
    const idx = order.indexOf(step)
    if (idx > 0) goToStep(order[idx - 1])
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
    goToStep('done')
  }

  const resetForAnother = () => {
    setName(''); setBrand(''); setLocation('cupboard'); setQuantity(1); setUnit('units')
    setExpiry(''); setImgUrl(null); setPhotos([]); setPhotoNotes(null); setMaxQuantity(null)
    setStep(autoCamera ? 'detect' : 'name')
  }

  // Progress bar (steps 1-5, not counting detect or done)
  const progressSteps: Step[] = ['name', 'quantity', 'expiry', 'location', 'confirm']
  const progressIndex = progressSteps.indexOf(step)
  const progressPct = progressIndex >= 0 ? ((progressIndex + 1) / progressSteps.length) * 100 : 0

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? '25%' : '-25%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-25%' : '25%', opacity: 0 }),
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 rounded-t-3xl border-t border-base-300 max-w-2xl mx-auto shadow-xl overflow-hidden"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      >
        {/* Progress bar */}
        {step !== 'detect' && step !== 'done' && (
          <div className="h-1 bg-base-200">
            <motion.div className="h-full bg-primary" animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }} />
          </div>
        )}

        <div className="p-6 pb-10">
          <div className="w-10 h-1 bg-base-300 rounded-full mx-auto mb-4" />

          {/* Header */}
          {step !== 'done' && (
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {step !== 'detect' && step !== 'name' && (
                  <button className="btn btn-ghost btn-sm btn-circle" onClick={prevStep}>
                    <ChevronLeft size={18} />
                  </button>
                )}
                {step === 'name' && autoCamera && (
                  <button className="btn btn-ghost btn-sm btn-circle" onClick={() => goToStep('detect')}>
                    <ChevronLeft size={18} />
                  </button>
                )}
              </div>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          )}

          {/* Step content */}
          <AnimatePresence mode="wait" custom={direction}>

            {/* ── DETECT (photo capture) ── */}
            {step === 'detect' && (
              <motion.div key="detect" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold">Take photos</h2>
                <p className="text-sm text-base-content/50">Snap the front label, quantity, or best-before date</p>

                {photos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {photos.map((photo, i) => (
                        <div key={i} className="relative flex-shrink-0">
                          <img src={photo} alt={`Capture ${i + 1}`}
                            className="w-20 h-20 rounded-xl object-cover border border-base-300" />
                          <button onClick={() => removePhoto(i)}
                            className="absolute -top-1.5 -right-1.5 btn btn-circle btn-xs bg-base-300 border-0">
                            <X size={10} />
                          </button>
                          {i === 0 && (
                            <span className="absolute bottom-1 left-1 text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded-md font-medium">
                              Front
                            </span>
                          )}
                        </div>
                      ))}
                      {photos.length < MAX_PHOTOS && (
                        <button onClick={() => setShowCamera(true)}
                          className="w-20 h-20 rounded-xl border-2 border-dashed border-base-300 flex flex-col items-center justify-center gap-1 hover:border-primary/40 transition-colors flex-shrink-0">
                          <Plus size={16} className="text-base-content/30" />
                          <span className="text-[9px] text-base-content/30">Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {photos.length === 0 && !photoLoading && (
                  <button type="button" onClick={() => setShowCamera(true)}
                    className="btn btn-ghost w-full rounded-2xl border border-dashed border-base-300 hover:border-primary/40 hover:bg-primary/5 h-auto py-8 gap-2 flex-col">
                    <Camera size={24} className="text-base-content/40" />
                    <span className="text-sm text-base-content/50">Tap to open camera</span>
                  </button>
                )}

                {photoLoading && (
                  <div className="flex items-center gap-3 p-4 bg-base-200 rounded-2xl">
                    <Loader2 size={18} className="text-primary animate-spin" />
                    <p className="text-sm font-medium">Analysing {photos.length} photo{photos.length !== 1 ? 's' : ''}…</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button onClick={() => goToStep('name')} className="btn btn-ghost flex-1 rounded-2xl text-sm">
                    Skip — enter manually
                  </button>
                  {photos.length > 0 && (
                    <button onClick={analysePhotos} disabled={photoLoading}
                      className="btn btn-primary flex-1 rounded-2xl text-sm">
                      {photoLoading ? <Loader2 size={16} className="animate-spin" /> : 'Analyse'}
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── NAME ── */}
            {step === 'name' && (
              <motion.div key="name" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold">What is it?</h2>

                {/* Photo analysis banner */}
                {photos.length > 0 && photoNotes && (
                  <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/20">
                    <div className="flex -space-x-2 flex-shrink-0">
                      {photos.slice(0, 3).map((photo, i) => (
                        <img key={i} src={photo} alt="" className="w-8 h-8 rounded-lg object-cover border-2 border-base-100"
                          style={{ zIndex: 3 - i }} />
                      ))}
                    </div>
                    <p className="text-xs text-base-content/50 line-clamp-2">{photoNotes}</p>
                  </div>
                )}

                {/* Barcode banner */}
                {imgUrl && (
                  <div className="flex items-center gap-3 p-3 bg-success/5 rounded-2xl border border-success/20">
                    <img src={imgUrl} alt={name} className="w-10 h-10 rounded-xl object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <p className="text-xs font-semibold text-success">Product found from scan</p>
                  </div>
                )}

                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs">Name</legend>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim()) nextStep() }}
                    placeholder="e.g. Oat milk, Garlic, Frozen peas"
                    className="input input-bordered w-full text-lg" autoFocus />
                </fieldset>

                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs">Brand (optional)</legend>
                  <input type="text" value={brand} onChange={e => setBrand(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') nextStep() }}
                    placeholder="e.g. Oatly" className="input input-bordered w-full" />
                </fieldset>

                <button onClick={nextStep} disabled={!name.trim()}
                  className="btn btn-primary w-full rounded-2xl">
                  Next <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {/* ── QUANTITY ── */}
            {step === 'quantity' && (
              <motion.div key="quantity" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h2 className="text-xl font-bold">How much is there?</h2>

                {/* Editable number + unit display */}
                <div className="flex items-end justify-center gap-3">
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                    min={0.1}
                    step={0.1}
                    className="input input-ghost text-4xl font-bold font-mono tabular-nums text-center w-32 p-0 h-auto focus:outline-none focus:bg-base-200 rounded-xl"
                  />
                  <span className="text-lg text-base-content/40 font-medium pb-1">{unit}</span>
                </div>

                {/* Slider + Full button */}
                <div className="flex items-center gap-3 px-2">
                  <div className="flex-1">
                    <QuantityPicker value={quantity} onChange={setQuantity}
                      min={qtyStep} max={qtyMax} step={qtyStep} />
                  </div>
                  <button
                    onClick={() => setQuantity(qtyMax)}
                    className={`btn btn-sm rounded-xl flex-shrink-0 ${quantity >= qtyMax ? 'btn-success btn-outline' : 'btn-ghost border border-base-300'}`}
                  >
                    Full
                  </button>
                </div>

                {/* Unit quick-select pills + custom input */}
                <div>
                  <p className="fieldset-legend text-xs mb-2">Measured in</p>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {UNITS.map(u => (
                      <button key={u} onClick={() => setUnit(u)}
                        className={`btn btn-xs rounded-lg ${unit === u ? 'btn-primary' : 'btn-ghost border border-base-300'}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                  <input
                    list="unit-picker-options"
                    value={UNITS.includes(unit) ? '' : unit}
                    onChange={e => { if (e.target.value) setUnit(e.target.value) }}
                    placeholder="Or type a custom unit…"
                    className="input input-bordered input-sm w-full rounded-xl"
                  />
                  <datalist id="unit-picker-options">
                    {['slices', 'pieces', 'cans', 'bottles', 'bags'].map(u => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                <div className="flex gap-2">
                  <button onClick={nextStep} className="btn btn-ghost flex-1 rounded-2xl text-sm">Skip</button>
                  <button onClick={nextStep} className="btn btn-primary flex-1 rounded-2xl text-sm">
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── EXPIRY ── */}
            {step === 'expiry' && (
              <motion.div key="expiry" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold">Best before?</h2>
                <p className="text-sm text-base-content/50">We'll remind you when it's close to expiring</p>

                <fieldset className="fieldset">
                  <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                    className="input input-bordered w-full text-lg" autoFocus />
                </fieldset>

                <div className="flex gap-2">
                  <button onClick={nextStep} className="btn btn-ghost flex-1 rounded-2xl text-sm">Skip</button>
                  <button onClick={nextStep} className="btn btn-primary flex-1 rounded-2xl text-sm">
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── LOCATION ── */}
            {step === 'location' && (
              <motion.div key="location" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold">Where does it go?</h2>

                <div className="grid grid-cols-2 gap-2.5">
                  {LOCATIONS.map(loc => (
                    <button key={loc} onClick={() => { setLocation(loc); nextStep() }}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${location === loc
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-base-300 hover:border-base-content/20'}`}>
                      <span className="text-2xl">{LOC_EMOJI[loc]}</span>
                      <span className="text-sm font-semibold">{LOC_LABELS[loc]}</span>
                    </button>
                  ))}
                </div>

                <button onClick={nextStep} className="btn btn-ghost w-full rounded-2xl text-sm">
                  Skip
                </button>
              </motion.div>
            )}

            {/* ── CONFIRM ── */}
            {step === 'confirm' && (
              <motion.div key="confirm" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold">Looks right?</h2>

                <div className="bg-base-200 rounded-2xl p-4 space-y-3">
                  {/* Photo thumbnails */}
                  {photos.length > 0 && (
                    <div className="flex -space-x-2 mb-2">
                      {photos.slice(0, 4).map((p, i) => (
                        <img key={i} src={p} alt="" className="w-10 h-10 rounded-lg object-cover border-2 border-base-200"
                          style={{ zIndex: 4 - i }} />
                      ))}
                    </div>
                  )}
                  {imgUrl && (
                    <img src={imgUrl} alt={name} className="w-12 h-12 rounded-xl object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{name || 'Unnamed item'}</h3>
                      {brand && <p className="text-sm text-base-content/50">{brand}</p>}
                    </div>
                    <span className="text-sm font-mono text-base-content/50 mt-1">{formatQty(quantity)} {unit}</span>
                  </div>

                  <div className="flex gap-4 text-sm text-base-content/50">
                    <span>{LOC_EMOJI[location]} {LOC_LABELS[location]}</span>
                    {expiry && <span>📅 {new Date(expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>

                <button onClick={handleSubmit} disabled={loading || !name.trim()}
                  className="btn btn-primary w-full rounded-2xl">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Add to pantry'}
                </button>
              </motion.div>
            )}

            {/* ── DONE ── */}
            {step === 'done' && (
              <motion.div key="done" custom={1} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
                className="space-y-5 text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 400, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto"
                >
                  <Check size={32} className="text-success" />
                </motion.div>

                <div>
                  <h2 className="text-xl font-bold">Added!</h2>
                  <p className="text-sm text-base-content/50 mt-1">{name} is in your pantry</p>
                </div>

                <div className="flex gap-2">
                  <button onClick={onClose} className="btn btn-ghost flex-1 rounded-2xl">
                    Done
                  </button>
                  <button onClick={resetForAnother} className="btn btn-primary flex-1 rounded-2xl">
                    <RotateCcw size={14} /> Add another
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Camera overlay */}
      <AnimatePresence>
        {showCamera && (
          <motion.div className="fixed inset-0 z-[60] bg-black flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <video ref={videoRef} className="flex-1 w-full object-cover" playsInline muted />

            {photos.length > 0 && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-xs font-mono px-3 py-1.5 rounded-full">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} taken
              </div>
            )}

            <div className="flex items-center justify-between px-8 py-6 bg-black">
              <button onClick={() => setShowCamera(false)}
                className="btn btn-circle btn-ghost text-white border border-white/20">
                <X size={20} />
              </button>
              <button onClick={captureFrame}
                className="w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-95 transition-transform" />
              <div className="w-12" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
