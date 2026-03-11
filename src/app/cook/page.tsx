'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, Check, X, ArrowLeft, Mic } from 'lucide-react'
import { useRecipeStore } from '@/lib/stores/recipes'
import { usePantryStore } from '@/lib/stores/pantry'
import toast from 'react-hot-toast'
import { formatQty } from '@/lib/format'

function CookPageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { savedRecipes, fetchSavedRecipes } = useRecipeStore()
  const { fetchItems } = usePantryStore()

  const [view, setView] = useState<'pick' | 'describe' | 'preview' | 'done'>('pick')
  const [description, setDescription] = useState(params.get('description') || '')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ item_id: string; item_name: string; quantity_change: number; unit: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)

  useEffect(() => { fetchSavedRecipes() }, [])
  useEffect(() => { if (params.get('recipe_name') && description) setView('describe') }, [])

  const getPreview = async () => {
    setLoading(true)
    const res = await fetch('/api/recipes/cook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: selectedRecipeId || undefined, recipe_description: description || undefined, confirmed: false }),
    })
    const data = await res.json()
    setPreview(data.preview || [])
    setView('preview')
    setLoading(false)
  }

  const confirmCook = async () => {
    setLoading(true)
    await fetch('/api/recipes/cook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: selectedRecipeId || undefined, recipe_description: description || undefined, confirmed: true }),
    })
    await fetchItems()
    setView('done')
    setLoading(false)
  }

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Voice not supported — type instead'); return }
    const r = new SR()
    r.lang = 'en-GB'
    r.onresult = (e: SpeechRecognitionEvent) => setDescription(e.results[0][0].transcript)
    r.onend = () => setRecording(false)
    setRecording(true)
    r.start()
  }

  return (
    <div className="min-h-screen bg-base-100 px-4 pt-6 pb-24 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="btn btn-ghost btn-sm gap-2 -ml-2 mb-6">
        <ArrowLeft size={15} strokeWidth={1.75} /> Back to pantry
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-2xl bg-warning/10 flex items-center justify-center">
          <ChefHat size={20} className="text-warning" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-bold text-xl">Log a meal</h1>
          <p className="text-xs text-base-content/40">Pick a saved recipe or describe what you made</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'pick' && (
          <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            {savedRecipes.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">Saved recipes</p>
                  <div className="flex-1 h-px bg-base-300" />
                </div>
                <div className="space-y-2">
                  {savedRecipes.map(r => (
                    <button key={r.id} onClick={() => { setSelectedRecipeId(r.id); setView('describe') }}
                      className="btn btn-ghost w-full justify-between h-auto py-3.5 rounded-2xl border border-base-300 hover:border-primary/30 hover:bg-primary/5">
                      <div className="text-left">
                        <p className="font-semibold text-sm">{r.name}</p>
                        <p className="text-xs text-base-content/40 font-mono font-normal">
                          {r.ingredients.length} ingredients · cooked {r.cook_count}×
                        </p>
                      </div>
                      <Check size={15} className="text-base-content/30 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              {savedRecipes.length > 0 && (
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">Or describe it</p>
                  <div className="flex-1 h-px bg-base-300" />
                </div>
              )}
              <button onClick={() => setView('describe')}
                className="btn btn-ghost w-full justify-start h-auto py-3.5 rounded-2xl border border-base-300 hover:border-primary/30 hover:bg-primary/5">
                <div className="text-left">
                  <p className="font-semibold text-sm">Describe what I made</p>
                  <p className="text-xs text-base-content/40 font-normal">Type or speak — Claude figures out the ingredients</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {view === 'describe' && !selectedRecipeId && (
          <motion.div key="describe" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <button onClick={() => setView('pick')} className="btn btn-ghost btn-sm gap-1.5 -ml-2">
              <X size={13} /> Cancel
            </button>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">What did you make?</legend>
              <div className="relative">
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Pasta with tomato sauce, used half a tin of tomatoes, garlic, olive oil and dried spaghetti"
                  rows={4} className="textarea textarea-bordered w-full resize-none pr-12" />
                <button onClick={startVoice}
                  className={`btn btn-sm btn-circle absolute right-2 bottom-2 ${recording ? 'btn-error voice-recording' : 'btn-ghost'}`}>
                  <Mic size={14} />
                </button>
              </div>
              <p className="fieldset-label">Be as rough as you like. Claude makes sensible estimates.</p>
            </fieldset>
            <button onClick={getPreview} disabled={!description.trim() || loading} className="btn btn-warning w-full rounded-2xl">
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Preview deductions'}
            </button>
          </motion.div>
        )}

        {view === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <div>
              <h2 className="font-bold text-xl">Does this look right?</h2>
              <p className="text-sm text-base-content/40 mt-0.5">These will be deducted from your pantry.</p>
            </div>
            <div className="space-y-2">
              {preview.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-base-100 border border-base-300 rounded-2xl">
                  <span className="text-sm font-medium">{item.item_name}</span>
                  <span className="text-xs font-mono text-error">−{formatQty(Math.abs(item.quantity_change))}{item.unit}</span>
                </div>
              ))}
              {preview.length === 0 && (
                <p className="text-sm text-base-content/40 text-center py-6">
                  Couldn't match any pantry items.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setView('describe')} className="btn btn-ghost flex-1 rounded-2xl border border-base-300">Edit</button>
              <button onClick={confirmCook} disabled={loading || !preview.length} className="btn btn-success flex-1 rounded-2xl">
                {loading ? <span className="loading loading-spinner loading-sm" /> : <><Check size={15} /> Confirm</>}
              </button>
            </div>
          </motion.div>
        )}

        {view === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 space-y-5">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Check size={28} className="text-success" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-bold text-2xl">Logged!</h2>
              <p className="text-base-content/40 mt-1">Pantry updated.</p>
            </div>
            <button onClick={() => router.push('/')} className="btn btn-ghost btn-sm">Back to pantry</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CookPage() {
  return <Suspense><CookPageContent /></Suspense>
}
