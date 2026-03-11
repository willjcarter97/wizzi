'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, ChefHat, BookOpen, Plus, ScanLine, Mic, Camera, PenLine, X, Sparkles, Loader2 } from 'lucide-react'
import BarcodeScanner from '@/components/scanning/BarcodeScanner'
import VoiceInput from '@/components/voice/VoiceInput'
import AddItemSheet from '@/components/pantry/AddItemSheet'
import toast from 'react-hot-toast'
import type { BarcodeResult, PantryLocation, PantryUnit } from '@/types'

const TABS = [
  { href: '/',        icon: Home,     label: 'Home'    },
  { href: '/meals',   icon: ChefHat,  label: 'Recipes' },
  { href: '/recipes', icon: BookOpen, label: 'Saved'   },
]

type AddMethod = 'scan' | 'photo' | 'voice' | 'manual' | null
type Overlay = 'method-picker' | 'scanner' | 'voice' | 'add-item' | null

export interface QuickResult {
  name: string; brand: string; quantity: number; max_quantity: number
  unit: PantryUnit; location: PantryLocation
}

export default function BottomBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [autoCamera, setAutoCamera] = useState(false)
  const [scanResult, setScanResult] = useState<BarcodeResult | null>(null)
  const [quickResult, setQuickResult] = useState<QuickResult | null>(null)
  const [quickText, setQuickText] = useState('')
  const [quickLoading, setQuickLoading] = useState(false)

  const openMethod = (method: AddMethod) => {
    if (method === 'scan') { setOverlay('scanner'); return }
    if (method === 'voice') { setOverlay('voice'); return }
    if (method === 'photo') { setAutoCamera(true); setOverlay('add-item'); return }
    if (method === 'manual') { setAutoCamera(false); setOverlay('add-item'); return }
  }

  const handleQuickEntry = async () => {
    if (!quickText.trim()) return
    setQuickLoading(true)
    try {
      const res = await fetch('/api/scan/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickText.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setQuickResult({
        name: data.name || '', brand: data.brand || '',
        quantity: data.quantity || 1, max_quantity: data.max_quantity || data.quantity || 1,
        unit: (data.unit as PantryUnit) || 'units',
        location: (data.location as PantryLocation) || 'cupboard',
      })
      setQuickText('')
      setOverlay(null)
      setTimeout(() => setOverlay('add-item'), 50)
    } catch {
      toast.error("Couldn't parse — try manual entry")
    } finally {
      setQuickLoading(false)
    }
  }

  const handleScanResult = (result: BarcodeResult) => {
    setOverlay(null)
    setScanResult(result)
    setAutoCamera(false)
    setTimeout(() => setOverlay('add-item'), 50)
  }

  const closeAll = () => { setOverlay(null); setAutoCamera(false); setScanResult(null); setQuickResult(null); setQuickText('') }

  return (
    <>
      {/* Tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-base-300 bg-base-100/95 backdrop-blur-md pb-safe">
        <div className="flex items-stretch max-w-2xl mx-auto" style={{ minHeight: '4rem' }}>
          {TABS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <button key={href} onClick={() => router.push(href)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${active ? 'text-primary' : 'text-base-content/40 hover:text-base-content/70'}`}>
                <Icon size={22} strokeWidth={1.75} />
                <span className="text-[10px] tracking-wide uppercase font-medium">{label}</span>
              </button>
            )
          })}

          {/* Add button — distinct */}
          <button onClick={() => setOverlay(overlay === 'method-picker' ? null : 'method-picker')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${overlay === 'method-picker' ? 'text-primary' : 'text-base-content/40 hover:text-base-content/70'}`}>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center -mt-1">
              <Plus size={22} strokeWidth={2} className="text-primary" />
            </div>
            <span className="text-[10px] tracking-wide uppercase font-medium">Add</span>
          </button>
        </div>
      </div>

      {/* Method picker sheet */}
      <AnimatePresence>
        {overlay === 'method-picker' && (
          <>
            <motion.div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeAll} />
            <motion.div
              className="fixed bottom-[4.5rem] left-0 right-0 z-40 max-w-2xl mx-auto px-4 pb-4"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            >
              <div className="bg-base-100 rounded-2xl border border-base-300 shadow-xl p-2 space-y-2">
                {/* Quick add input */}
                <div className="relative px-1.5 pt-1.5">
                  <input
                    type="text"
                    value={quickText}
                    onChange={e => setQuickText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleQuickEntry() }}
                    placeholder="Quick add — &quot;whole avocado&quot;, &quot;500ml milk&quot;"
                    className="input input-bordered input-sm w-full pr-10 text-sm"
                    disabled={quickLoading}
                    autoFocus
                  />
                  <button
                    onClick={handleQuickEntry}
                    disabled={!quickText.trim() || quickLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 btn btn-primary btn-xs btn-circle"
                  >
                    {quickLoading
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Sparkles size={12} />}
                  </button>
                </div>

                <div className="flex items-center gap-3 px-1.5">
                  <div className="flex-1 h-px bg-base-300" />
                  <span className="text-[9px] text-base-content/30 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-base-300" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { method: 'scan' as const, icon: ScanLine, label: 'Scan barcode', desc: 'Read a product barcode' },
                    { method: 'photo' as const, icon: Camera, label: 'Take photo', desc: 'AI identifies the item' },
                    { method: 'voice' as const, icon: Mic, label: 'Voice', desc: 'Speak to add items' },
                    { method: 'manual' as const, icon: PenLine, label: 'Manual', desc: 'Type it in yourself' },
                  ].map(({ method, icon: Icon, label, desc }) => (
                    <button key={method} onClick={() => { setOverlay(null); setTimeout(() => openMethod(method), 50) }}
                      className="flex items-start gap-3 p-3.5 rounded-xl hover:bg-base-200 transition-colors text-left">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-primary" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-base-content/40">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <AnimatePresence mode="wait">
        {overlay === 'scanner' && (
          <BarcodeScanner key="scanner" onResult={handleScanResult} onClose={closeAll} />
        )}
        {overlay === 'voice' && (
          <VoiceInput key="voice" onClose={closeAll} onComplete={closeAll} />
        )}
        {overlay === 'add-item' && (
          <AddItemSheet key="add-item" onClose={closeAll} autoCamera={autoCamera} scanResult={scanResult} quickResult={quickResult} />
        )}
      </AnimatePresence>
    </>
  )
}
