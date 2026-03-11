'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useMealsStore } from '@/lib/stores/meals'
import { Clock, Check, ShoppingCart, BookmarkPlus, ChevronDown, ChevronUp, Sparkles, Search, ClipboardPaste, Link, Plus, History, Camera, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { MealCategory } from '@/types'

const CATEGORIES: { id: MealCategory; emoji: string; label: string; desc: string }[] = [
  { id: 'snack',  emoji: '\uD83C\uDF7F', label: 'Snack',       desc: '5-15 min' },
  { id: 'quick',  emoji: '\u26A1',        label: 'Quick meal',   desc: 'Under 30 min' },
  { id: 'proper', emoji: '\uD83C\uDF7D\uFE0F', label: 'Proper meal', desc: '30-90 min' },
  { id: 'batch',  emoji: '\uD83E\uDD58',  label: 'Batch cook',   desc: '10 portions' },
]

const MODE_TABS = [
  { id: 'ai' as const,    icon: Sparkles,       label: 'AI search' },
  { id: 'paste' as const, icon: ClipboardPaste,  label: 'Text / Photo' },
  { id: 'link' as const,  icon: Link,            label: 'From link' },
]

export default function MealsPage() {
  const store = useMealsStore()
  const { mode, category, query, pasteText, linkUrl, result, isSearching, error, recentFinds } = store
  const { setMode, setCategory, setQuery, setPasteText, setLinkUrl, findMeal, parseFromText, parseFromPhoto, parseFromLink, clearResult, saveResultAsRecipe, showRecent, loadRecentFinds } = store
  const [showInstructions, setShowInstructions] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => { loadRecentFinds() }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setShowCamera(true)
    } catch {
      toast.error('Could not access camera')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setShowCamera(false)
  }, [])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setPhotoPreview(dataUrl)
    stopCamera()
  }, [stopCamera])

  const handlePhotoSubmit = () => {
    if (!photoPreview) return
    parseFromPhoto(photoPreview)
    setPhotoPreview(null)
  }

  const handleCategoryTap = (catId: MealCategory) => {
    setCategory(category === catId ? null : catId)
  }

  const handleAiSearch = () => {
    if (!query.trim() && !category) {
      toast.error('Pick a category or describe what you want')
      return
    }
    findMeal()
  }

  const handlePaste = () => {
    if (!pasteText.trim()) {
      toast.error('Paste a recipe first')
      return
    }
    parseFromText()
  }

  const handleLink = () => {
    if (!linkUrl.trim()) {
      toast.error('Enter a URL first')
      return
    }
    try {
      new URL(linkUrl)
    } catch {
      toast.error('Enter a valid URL')
      return
    }
    parseFromLink()
  }

  const handleSave = async () => {
    try {
      await saveResultAsRecipe()
      toast.success('Saved to recipe book!')
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return (
    <div className="min-h-screen bg-base-100 px-4 pt-6 pb-28 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Plus size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Add a recipe</h1>
          <p className="text-sm text-base-content/40 mt-0.5">AI search, paste, or import from a link.</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!result && !isSearching && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

            {/* Mode tabs */}
            <div className="flex rounded-2xl border border-base-300 overflow-hidden">
              {MODE_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
                    mode === tab.id
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-100 text-base-content/50 hover:bg-base-200'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* AI search mode */}
            {mode === 'ai' && (
              <motion.div key="ai" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Category selector */}
                <div>
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-3">What kind of meal?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat.id} onClick={() => handleCategoryTap(cat.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                          category === cat.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-base-300 hover:border-base-content/20 active:scale-[0.98]'
                        }`}>
                        <span className="text-xl">{cat.emoji}</span>
                        <div>
                          <p className="text-sm font-semibold">{cat.label}</p>
                          <p className="text-xs text-base-content/40">{cat.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-base-300" />
                  <span className="text-[10px] text-base-content/30 uppercase tracking-widest">or describe what you fancy</span>
                  <div className="flex-1 h-px bg-base-300" />
                </div>

                {/* Free text */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-base-content/50 block">What are you craving?</label>
                  <textarea
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. Beef tacos, something Thai with chicken, a hearty soup..."
                    rows={3}
                    className="textarea textarea-bordered w-full resize-none text-sm"
                  />
                  <p className="text-xs text-base-content/30">Be specific or vague. The AI will find a real, authentic recipe.</p>
                </div>

                <button onClick={handleAiSearch}
                  disabled={!query.trim() && !category}
                  className="btn btn-primary w-full rounded-2xl gap-2">
                  <Search size={16} />
                  Find me a recipe
                </button>
              </motion.div>
            )}

            {/* Paste / Photo mode */}
            {mode === 'paste' && (
              <motion.div key="paste" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Photo preview */}
                {photoPreview && (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-base-300">
                      <img src={photoPreview} alt="Recipe photo" className="w-full h-48 object-cover" />
                      <button onClick={() => setPhotoPreview(null)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                        <X size={14} />
                      </button>
                    </div>
                    <button onClick={handlePhotoSubmit}
                      className="btn btn-primary w-full rounded-2xl gap-2">
                      <Sparkles size={16} />
                      Extract recipe from photo
                    </button>
                  </div>
                )}

                {/* Input options (hidden when photo is previewing) */}
                {!photoPreview && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-base-content/50 block">Paste your recipe</label>
                      <textarea
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                        placeholder={"Paste a recipe here - ingredients, instructions, the whole thing.\n\nIt can be messy - copied from a blog, a message, a cookbook photo OCR. The AI will clean it up."}
                        rows={6}
                        className="textarea textarea-bordered w-full resize-none text-sm"
                      />
                      <p className="text-xs text-base-content/30">
                        {pasteText.length > 0
                          ? `${pasteText.length.toLocaleString()} characters`
                          : 'Copy-paste from anywhere. Blogs, messages, notes.'}
                      </p>
                    </div>

                    <button onClick={handlePaste}
                      disabled={!pasteText.trim()}
                      className="btn btn-primary w-full rounded-2xl gap-2">
                      <ClipboardPaste size={16} />
                      Parse recipe
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-base-300" />
                      <span className="text-[10px] text-base-content/30 uppercase tracking-widest">or snap a photo</span>
                      <div className="flex-1 h-px bg-base-300" />
                    </div>

                    <button onClick={startCamera}
                      className="btn btn-ghost w-full rounded-2xl gap-2 border border-base-300">
                      <Camera size={16} />
                      Take a photo of a recipe
                    </button>
                    <p className="text-xs text-base-content/30 text-center">
                      Cookbook page, handwritten card, screenshot - anything with recipe text.
                    </p>
                  </>
                )}
              </motion.div>
            )}

            {/* Link mode */}
            {mode === 'link' && (
              <motion.div key="link" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-base-content/50 block">Recipe URL</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://www.bbcgoodfood.com/recipes/..."
                    className="input input-bordered w-full text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleLink() }}
                  />
                  <p className="text-xs text-base-content/30">
                    Paste a link to any recipe page. Works with most food blogs and recipe sites.
                  </p>
                </div>

                <button onClick={handleLink}
                  disabled={!linkUrl.trim()}
                  className="btn btn-primary w-full rounded-2xl gap-2">
                  <Link size={16} />
                  Import recipe
                </button>
              </motion.div>
            )}

            {/* Recent finds */}
            {recentFinds.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <History size={14} className="text-base-content/30" />
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">Recent finds</p>
                </div>
                <div className="space-y-2">
                  {recentFinds.map((find, i) => (
                    <button key={`${find.recipe_name}-${i}`} onClick={() => showRecent(find)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl border border-base-300 text-left hover:border-primary/20 hover:shadow-sm transition-all active:scale-[0.99]">
                      {find.image_url ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={find.image_url} alt={find.recipe_name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-base-200 flex items-center justify-center flex-shrink-0">
                          <Sparkles size={16} className="text-base-content/15" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{find.recipe_name}</p>
                        <p className="text-xs text-base-content/40 truncate mt-0.5">
                          {find.origin} · {find.prep_time_minutes + find.cook_time_minutes}m · Serves {find.servings}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Loading */}
        {isSearching && (
          <motion.div key="loading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-center py-20 space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles size={24} className="text-primary animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {mode === 'ai' ? 'Researching authentic recipes...' :
                 mode === 'paste' ? 'Parsing your recipe...' :
                 'Fetching and parsing recipe...'}
              </p>
              <p className="text-sm text-base-content/40 mt-1">
                {mode === 'ai' ? 'Finding the real deal, not a shortcut version.' :
                 'Extracting ingredients, steps, and details.'}
              </p>
            </div>
            <span className="loading loading-dots loading-md text-primary" />
          </motion.div>
        )}

        {/* Error */}
        {error && !isSearching && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="alert alert-error">
              <p>{error}</p>
              <button onClick={clearResult} className="btn btn-sm btn-ghost">Try again</button>
            </div>
          </motion.div>
        )}

        {/* Result - full-screen detail view */}
        {result && !isSearching && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 bg-base-100 flex flex-col">

            {/* Fixed hero */}
            <div className="relative flex-shrink-0">
              {result.image_url ? (
                <div className="relative h-52">
                  <img src={result.image_url} alt={result.recipe_name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                  <div className="absolute top-3 left-3 z-10">
                    <button onClick={clearResult}
                      className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
                      <ChevronDown size={18} className="rotate-90" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className="flex items-center gap-2 mb-1.5">
                      {result.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="badge badge-sm badge-outline border-white/30 text-white/80">{tag}</span>
                      ))}
                      <span className="flex items-center gap-1 text-xs text-white/70 font-mono">
                        <Clock size={11} /> {result.prep_time_minutes + result.cook_time_minutes}m
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white leading-tight">{result.recipe_name}</h2>
                    {result.origin && <p className="text-sm text-white/70 mt-1">{result.origin}</p>}
                  </div>
                </div>
              ) : (
                <div className="px-5 pt-12 pb-4 border-b border-base-200">
                  <div className="absolute top-3 left-3 z-10">
                    <button onClick={clearResult}
                      className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center">
                      <ChevronDown size={18} className="rotate-90 text-base-content/50" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    {result.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="badge badge-sm badge-outline badge-primary">{tag}</span>
                    ))}
                    <span className="flex items-center gap-1 text-xs text-base-content/40 font-mono">
                      <Clock size={11} /> {result.prep_time_minutes + result.cook_time_minutes}m
                    </span>
                  </div>
                  <h2 className="text-xl font-bold leading-tight">{result.recipe_name}</h2>
                  {result.origin && <p className="text-sm text-primary font-medium mt-1">{result.origin}</p>}
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-5 space-y-5 max-w-2xl mx-auto">
                {result.why_authentic && <p className="text-sm text-base-content/50 italic">{result.why_authentic}</p>}
                {result.source_note && <p className="text-xs text-base-content/30 font-mono">{result.source_note}</p>}

                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-base-content/50 font-mono">Serves {result.servings}</span>
                </div>

                {result.ingredients_have.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Check size={14} className="text-success" />
                      <p className="text-xs font-semibold text-success uppercase tracking-widest">You have</p>
                    </div>
                    <div className="space-y-1">
                      {result.ingredients_have.map((ing, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-success/5 border border-success/10 rounded-xl">
                          <span className="text-sm">{ing.name}</span>
                          <span className="text-xs font-mono text-base-content/40">{ing.quantity} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.ingredients_need.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart size={14} className="text-warning" />
                      <p className="text-xs font-semibold text-warning uppercase tracking-widest">Need to buy</p>
                    </div>
                    <div className="space-y-1">
                      {result.ingredients_need.map((ing, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-warning/5 border border-warning/10 rounded-xl">
                          <span className="text-sm">{ing.name}</span>
                          <span className="text-xs font-mono text-base-content/40">{ing.quantity} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <button onClick={() => setShowInstructions(!showInstructions)}
                    className="flex items-center justify-between w-full py-2">
                    <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">Instructions ({result.instructions.length} steps)</p>
                    {showInstructions ? <ChevronUp size={16} className="text-base-content/30" /> : <ChevronDown size={16} className="text-base-content/30" />}
                  </button>
                  <AnimatePresence>
                    {showInstructions && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <ol className="space-y-3 pb-2">
                          {result.instructions.map((step, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-base-content/50">{i + 1}</span>
                              <p className="text-sm leading-relaxed">{step}</p>
                            </li>
                          ))}
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Fixed bottom toolbar */}
            <div className="flex-shrink-0 border-t border-base-200 bg-base-100 px-5 py-3 safe-b">
              <div className="flex gap-3 max-w-2xl mx-auto">
                <button onClick={clearResult} className="btn btn-ghost rounded-2xl border border-base-300">
                  &#8592; Back
                </button>
                <button onClick={handleSave} className="btn btn-primary flex-1 rounded-2xl gap-2">
                  <BookmarkPlus size={16} /> Save to recipes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera overlay */}
      {showCamera && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="absolute top-4 right-4 z-10">
            <button onClick={stopCamera}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <div className="flex-shrink-0 flex justify-center py-8 bg-black">
            <button onClick={capturePhoto}
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform">
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
