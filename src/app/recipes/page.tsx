'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Trash2, ChefHat, Check, ShoppingCart, X, ChevronDown, ChevronUp, ImageOff, BookOpen, Minus, Plus, Pencil, Save, Image, Search } from 'lucide-react'
import { useRecipeStore } from '@/lib/stores/recipes'
import { usePantryStore } from '@/lib/stores/pantry'
import toast from 'react-hot-toast'
import type { Recipe, PantryItem, MealCategory, RecipeIngredient, PantryUnit } from '@/types'

const MEAL_BADGE: Record<string, string> = {
  snack:  'badge-success',
  quick:  'badge-info',
  proper: 'badge-primary',
  batch:  'badge-warning',
}

const MEAL_LABELS: Record<string, string> = {
  snack:  'Snack',
  quick:  'Quick meal',
  proper: 'Proper meal',
  batch:  'Batch cook',
}

function matchIngredients(recipe: Recipe, pantryItems: PantryItem[]) {
  const pantryNames = pantryItems.map(p => p.name.toLowerCase())
  const have: string[] = []
  const need: string[] = []

  for (const ing of recipe.ingredients) {
    const ingName = ing.name.toLowerCase()
    const matched = pantryNames.some(pn =>
      pn.includes(ingName) || ingName.includes(pn) ||
      ingName.split(' ').every(word => pn.includes(word))
    )
    if (matched) have.push(ing.name)
    else need.push(ing.name)
  }

  return { have, need, total: recipe.ingredients.length }
}

/** Scale a quantity by a multiplier, rounding to sensible precision */
function scaleQty(qty: number, multiplier: number): number {
  const scaled = qty * multiplier
  if (scaled >= 10) return Math.round(scaled)
  if (scaled >= 1) return Math.round(scaled * 10) / 10
  return Math.round(scaled * 100) / 100
}

// ─── Edit Modal ─────────────────────────────────────────────────────────────

function EditRecipeModal({ recipe, onClose, onSave }: {
  recipe: Recipe
  onClose: () => void
  onSave: (updates: Partial<Recipe>) => void
}) {
  const [name, setName] = useState(recipe.name)
  const [description, setDescription] = useState(recipe.description)
  const [imageUrl, setImageUrl] = useState(recipe.image_url || '')
  const [imageSearching, setImageSearching] = useState(false)
  const [prepTime, setPrepTime] = useState(recipe.prep_time_minutes)
  const [cookTime, setCookTime] = useState(recipe.cook_time_minutes)
  const [servings, setServings] = useState(recipe.servings)
  const [mealType, setMealType] = useState(recipe.meal_type)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe.ingredients.map(i => ({ ...i }))
  )
  const [instructions, setInstructions] = useState<string[]>([...recipe.instructions])

  const updateIngredient = (idx: number, field: string, value: string | number | boolean) => {
    setIngredients(prev => prev.map((ing, i) =>
      i === idx ? { ...ing, [field]: value } : ing
    ))
  }

  const removeIngredient = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: '', quantity: 1, unit: 'units' as PantryUnit, optional: false }])
  }

  const updateInstruction = (idx: number, value: string) => {
    setInstructions(prev => prev.map((s, i) => i === idx ? value : s))
  }

  const removeInstruction = (idx: number) => {
    setInstructions(prev => prev.filter((_, i) => i !== idx))
  }

  const addInstruction = () => {
    setInstructions(prev => [...prev, ''])
  }

  const searchImage = async () => {
    if (!name.trim()) return
    setImageSearching(true)
    try {
      const res = await fetch(`/api/recipes/image?q=${encodeURIComponent(name)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.url) setImageUrl(data.url)
        else toast.error('No image found - try a different name')
      }
    } catch {
      toast.error('Image search failed')
    } finally {
      setImageSearching(false)
    }
  }

  const handleSave = () => {
    onSave({
      name,
      description,
      image_url: imageUrl || undefined,
      prep_time_minutes: prepTime,
      cook_time_minutes: cookTime,
      servings,
      meal_type: mealType,
      ingredients: ingredients.filter(i => i.name.trim()),
      instructions: instructions.filter(s => s.trim()),
    })
  }

  return (
    <>
      <motion.div className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} />

      <motion.div
        className="fixed inset-x-0 bottom-0 z-[60] bg-base-100 rounded-t-3xl max-w-2xl mx-auto max-h-[92vh] overflow-y-auto shadow-2xl"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        <div className="sticky top-0 bg-base-100 z-10 px-5 pt-4 pb-3 border-b border-base-200 rounded-t-3xl">
          <div className="w-10 h-1 bg-base-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Edit recipe</h2>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handleSave} className="btn btn-primary btn-sm gap-1.5">
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Image */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-base-content/50 block">Image</label>
            {imageUrl && (
              <div className="relative rounded-xl overflow-hidden border border-base-300">
                <img src={imageUrl} alt="Recipe" className="w-full h-36 object-cover" />
                <button onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="Paste image URL or search below"
                className="input input-bordered input-sm flex-1 text-sm" />
              <button onClick={searchImage} disabled={imageSearching || !name.trim()}
                className="btn btn-ghost btn-sm gap-1.5 border border-base-300">
                {imageSearching
                  ? <span className="loading loading-spinner loading-xs" />
                  : <Search size={13} />}
                Find
              </button>
            </div>
            <p className="text-[10px] text-base-content/30">Paste a URL directly, or click Find to search Pexels by recipe name.</p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-base-content/50 block">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="input input-bordered w-full text-sm" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-base-content/50 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className="textarea textarea-bordered w-full text-sm resize-none" />
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-base-content/40 uppercase block">Prep (min)</label>
              <input type="number" value={prepTime} onChange={e => setPrepTime(+e.target.value)}
                className="input input-bordered input-sm w-full text-sm font-mono" min={0} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-base-content/40 uppercase block">Cook (min)</label>
              <input type="number" value={cookTime} onChange={e => setCookTime(+e.target.value)}
                className="input input-bordered input-sm w-full text-sm font-mono" min={0} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-base-content/40 uppercase block">Servings</label>
              <input type="number" value={servings} onChange={e => setServings(+e.target.value)}
                className="input input-bordered input-sm w-full text-sm font-mono" min={1} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-base-content/40 uppercase block">Type</label>
              <select value={mealType} onChange={e => setMealType(e.target.value as MealCategory)}
                className="select select-bordered select-sm w-full text-sm">
                <option value="snack">Snack</option>
                <option value="quick">Quick</option>
                <option value="proper">Proper</option>
                <option value="batch">Batch</option>
              </select>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-base-content/50">Ingredients</label>
              <button onClick={addIngredient} className="btn btn-ghost btn-xs gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                  placeholder="Ingredient" className="input input-bordered input-sm flex-1 text-sm" />
                <input type="number" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', +e.target.value)}
                  className="input input-bordered input-sm w-16 text-sm font-mono" min={0} step="any" />
                <input type="text" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}
                  className="input input-bordered input-sm w-14 text-sm font-mono" placeholder="unit" />
                <button onClick={() => removeIngredient(i)} className="btn btn-ghost btn-xs btn-square text-error/50 hover:text-error">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="space-y-2 pb-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-base-content/50">Instructions</label>
              <button onClick={addInstruction} className="btn btn-ghost btn-xs gap-1">
                <Plus size={12} /> Add step
              </button>
            </div>
            {instructions.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-6 h-8 flex items-center justify-center text-xs font-bold text-base-content/30 flex-shrink-0">{i + 1}</span>
                <textarea value={step} onChange={e => updateInstruction(i, e.target.value)}
                  rows={2} className="textarea textarea-bordered flex-1 text-sm resize-none" />
                <button onClick={() => removeInstruction(i)} className="btn btn-ghost btn-xs btn-square text-error/50 hover:text-error mt-1">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── Detail Modal ───────────────────────────────────────────────────────────

function RecipeDetail({ recipe, pantryItems, onClose, onRemove }: {
  recipe: Recipe
  pantryItems: PantryItem[]
  onClose: () => void
  onRemove: () => void
}) {
  const [showSteps, setShowSteps] = useState(true)
  const [scale, setScale] = useState(recipe.servings)
  const [editing, setEditing] = useState(false)
  const { updateRecipe } = useRecipeStore()

  const multiplier = scale / recipe.servings
  const { have, need } = matchIngredients(recipe, pantryItems)

  const handleEditSave = async (updates: Partial<Recipe>) => {
    await updateRecipe(recipe.id, updates)
    setEditing(false)
    toast.success('Recipe updated')
  }

  return (
    <>
      <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} />

      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 bg-base-100 rounded-t-3xl w-full max-w-2xl mx-auto max-h-[92vh] flex flex-col shadow-2xl"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        {/* Hero image or fallback - fixed header */}
        <div className="relative rounded-t-3xl overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-3">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <button onClick={() => setEditing(true)}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
              <Pencil size={14} />
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
              <X size={16} />
            </button>
          </div>

          {recipe.image_url ? (
            <div className="relative h-52">
              <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`badge badge-sm ${MEAL_BADGE[recipe.meal_type] ?? 'badge-neutral'}`}>
                    {MEAL_LABELS[recipe.meal_type] ?? recipe.meal_type}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-white/70 font-mono">
                    <Clock size={11} /> {recipe.prep_time_minutes + recipe.cook_time_minutes}m
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">{recipe.country_flag && `${recipe.country_flag} `}{recipe.name}</h2>
              </div>
            </div>
          ) : (
            <div className="px-5 pb-4 pt-6">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`badge badge-sm ${MEAL_BADGE[recipe.meal_type] ?? 'badge-neutral'}`}>
                  {MEAL_LABELS[recipe.meal_type] ?? recipe.meal_type}
                </div>
                <span className="flex items-center gap-1 text-xs text-base-content/40 font-mono">
                  <Clock size={11} /> {recipe.prep_time_minutes + recipe.cook_time_minutes}m
                </span>
              </div>
              <h2 className="text-xl font-bold leading-tight">{recipe.country_flag && `${recipe.country_flag} `}{recipe.name}</h2>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-10 space-y-5">
          {recipe.description && (
            <p className="text-sm text-base-content/60 leading-relaxed">{recipe.description}</p>
          )}

          {/* Servings scaler */}
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-2xl">
            <div>
              <p className="text-sm font-semibold">Servings</p>
              <p className="text-xs text-base-content/40">
                {scale !== recipe.servings
                  ? `Scaled from ${recipe.servings} (x${multiplier % 1 === 0 ? multiplier : multiplier.toFixed(1)})`
                  : `Original recipe serves ${recipe.servings}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setScale(Math.max(1, scale - 1))}
                className="btn btn-ghost btn-xs btn-circle border border-base-300">
                <Minus size={14} />
              </button>
              <span className="text-lg font-bold font-mono w-8 text-center">{scale}</span>
              <button onClick={() => setScale(scale + 1)}
                className="btn btn-ghost btn-xs btn-circle border border-base-300">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Availability summary */}
          <div className="flex items-center gap-3 p-3 bg-base-200 rounded-2xl">
            <div className="radial-progress text-primary text-xs font-bold"
              style={{ '--value': Math.round((have.length / (have.length + need.length)) * 100), '--size': '3rem', '--thickness': '3px' } as React.CSSProperties}>
              {have.length}/{have.length + need.length}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {need.length === 0 ? 'Ready to cook!' : `Need ${need.length} more ingredient${need.length !== 1 ? 's' : ''}`}
              </p>
              <p className="text-xs text-base-content/40">
                {have.length} of {have.length + need.length} ingredients in your kitchen
              </p>
            </div>
          </div>

          {/* Ingredients - have */}
          {have.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Check size={14} className="text-success" />
                <p className="text-xs font-semibold text-success uppercase tracking-widest">In your kitchen</p>
              </div>
              <div className="space-y-1">
                {recipe.ingredients.filter(ing => have.includes(ing.name)).map((ing, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-success/5 border border-success/10 rounded-xl">
                    <span className="text-sm">{ing.name}</span>
                    <span className="text-xs font-mono text-base-content/40">
                      {scaleQty(ing.quantity, multiplier)} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients - need */}
          {need.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={14} className="text-warning" />
                <p className="text-xs font-semibold text-warning uppercase tracking-widest">Need to buy</p>
              </div>
              <div className="space-y-1">
                {recipe.ingredients.filter(ing => need.includes(ing.name)).map((ing, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-warning/5 border border-warning/10 rounded-xl">
                    <span className="text-sm">{ing.name}</span>
                    <span className="text-xs font-mono text-base-content/40">
                      {scaleQty(ing.quantity, multiplier)} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div>
            <button onClick={() => setShowSteps(!showSteps)}
              className="flex items-center justify-between w-full py-2">
              <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">
                Instructions ({recipe.instructions.length} steps)
              </p>
              {showSteps ? <ChevronUp size={16} className="text-base-content/30" /> : <ChevronDown size={16} className="text-base-content/30" />}
            </button>
            <AnimatePresence>
              {showSteps && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <ol className="space-y-3 pb-2">
                    {recipe.instructions.map((step, i) => (
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

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map(tag => (
                <span key={tag} className="badge badge-sm badge-outline badge-primary">{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <a href={`/cook?recipe_id=${recipe.id}`}
              className="btn btn-primary flex-1 rounded-2xl gap-2">
              <ChefHat size={16} /> Cook this
            </a>
            <button onClick={() => setEditing(true)}
              className="btn btn-ghost rounded-2xl border border-base-300 gap-2">
              <Pencil size={14} /> Edit
            </button>
            <button onClick={onRemove}
              className="btn btn-ghost rounded-2xl border border-base-300 hover:btn-error">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <EditRecipeModal
            key="edit"
            recipe={recipe}
            onClose={() => setEditing(false)}
            onSave={handleEditSave}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Recipe Card ────────────────────────────────────────────────────────────

function RecipeCard({ recipe, pantryItems, index, onClick }: {
  recipe: Recipe
  pantryItems: PantryItem[]
  index: number
  onClick: () => void
}) {
  const { have, need, total } = matchIngredients(recipe, pantryItems)
  const pct = total > 0 ? Math.round((have.length / total) * 100) : 0

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden border border-base-300 shadow-sm hover:shadow-md hover:border-primary/20 transition-all active:scale-[0.99] bg-base-100"
    >
      <div className="flex">
        <div className="w-24 flex-shrink-0 self-stretch relative bg-base-200">
          {recipe.image_url ? (
            <img src={recipe.image_url} alt={recipe.name}
              className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-base-200">
              <ImageOff size={20} className="text-base-content/15" />
            </div>
          )}
          {pct === 100 && (
            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-success flex items-center justify-center shadow-sm">
              <Check size={11} className="text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <div className={`badge badge-xs ${MEAL_BADGE[recipe.meal_type] ?? 'badge-neutral'}`}>
              {MEAL_LABELS[recipe.meal_type] ?? recipe.meal_type}
            </div>
            <span className="flex items-center gap-1 text-[10px] text-base-content/40 font-mono">
              <Clock size={9} /> {recipe.prep_time_minutes + recipe.cook_time_minutes}m
            </span>
            <span className="text-[10px] text-base-content/40 font-mono">
              Serves {recipe.servings}
            </span>
          </div>

          <h3 className="font-bold text-sm leading-tight line-clamp-1">{recipe.country_flag && `${recipe.country_flag} `}{recipe.name}</h3>
          <p className="text-xs text-base-content/40 mt-0.5 line-clamp-1">{recipe.description}</p>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-base-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-semibold ${pct === 100 ? 'text-success' : pct >= 50 ? 'text-primary' : 'text-warning'}`}>
              {have.length}/{total}
            </span>
          </div>

          {need.length === 0 ? (
            <p className="text-[10px] text-success font-mono mt-1 font-semibold">Ready to cook</p>
          ) : (
            <p className="text-[10px] text-base-content/30 font-mono mt-1 line-clamp-1">
              Need: {need.slice(0, 3).join(', ')}{need.length > 3 ? ` +${need.length - 3}` : ''}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const { savedRecipes, fetchSavedRecipes, removeRecipe, isLoading } = useRecipeStore()
  const { items: pantryItems, fetchItems } = usePantryStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<MealCategory | 'all'>('all')

  useEffect(() => { fetchSavedRecipes(); fetchItems() }, [])

  const filteredRecipes = useMemo(
    () => filter === 'all'
      ? savedRecipes
      : savedRecipes.filter(r => r.meal_type === filter),
    [savedRecipes, filter]
  )

  const selectedRecipe = useMemo(
    () => savedRecipes.find(r => r.id === selectedId) || null,
    [savedRecipes, selectedId]
  )

  const handleRemove = async (id: string, name: string) => {
    await removeRecipe(id)
    setSelectedId(null)
    toast.success(`Removed "${name}"`)
  }

  return (
    <div className="min-h-screen bg-base-100 px-4 pt-6 pb-24 max-w-2xl mx-auto overflow-x-hidden">
      <div className="flex items-end justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-2xl leading-tight">Recipe book</h1>
            <p className="text-xs text-base-content/40 font-mono">{savedRecipes.length} saved</p>
          </div>
        </div>
      </div>

      {savedRecipes.length > 0 && (
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {(['all', 'snack', 'quick', 'proper', 'batch'] as const).map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filter === tab
                  ? 'bg-primary text-primary-content'
                  : 'bg-base-200 text-base-content/50 hover:bg-base-300'
              }`}>
              {tab === 'all' ? 'All' : MEAL_LABELS[tab]}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex rounded-2xl overflow-hidden border border-base-300">
              <div className="w-24 h-24 skeleton flex-shrink-0" />
              <div className="flex-1 p-3.5 space-y-2">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && savedRecipes.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center mx-auto">
            <BookOpen size={28} className="text-base-content/15" />
          </div>
          <div>
            <p className="text-lg font-semibold text-base-content/25">No saved recipes</p>
            <p className="text-sm text-base-content/30 mt-1">
              Add recipes in the <span className="font-semibold">Recipes</span> tab.
            </p>
          </div>
        </div>
      )}

      {!isLoading && savedRecipes.length > 0 && filteredRecipes.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-base-content/30">
            No {MEAL_LABELS[filter as MealCategory]?.toLowerCase()} recipes saved yet.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filteredRecipes.map((recipe, i) => (
          <RecipeCard key={recipe.id} recipe={recipe} pantryItems={pantryItems} index={i}
            onClick={() => setSelectedId(recipe.id)} />
        ))}
      </div>

      <AnimatePresence>
        {selectedRecipe && (
          <RecipeDetail key={selectedRecipe.id} recipe={selectedRecipe} pantryItems={pantryItems}
            onClose={() => setSelectedId(null)}
            onRemove={() => handleRemove(selectedRecipe.id, selectedRecipe.name)} />
        )}
      </AnimatePresence>
    </div>
  )
}
