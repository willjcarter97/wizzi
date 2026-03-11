'use client'

import { useRecipeStore } from '@/lib/stores/recipes'
import { motion } from 'framer-motion'
import { Clock, RefreshCw, BookmarkPlus, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import type { MealType, RecipeSuggestion } from '@/types'

const MEAL_ORDER: MealType[] = ['breakfast', 'snack', 'lunch', 'dinner']

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', snack: 'Snack', lunch: 'Lunch', dinner: 'Dinner',
}

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅', snack: '🍎', lunch: '☀️', dinner: '🌙',
}

const MEAL_BADGE: Record<MealType, string> = {
  breakfast: 'badge-warning',
  snack:     'badge-success',
  lunch:     'badge-info',
  dinner:    'badge-primary',
}

export default function DailyPlanStrip() {
  const { dailyPlan, isLoading, fetchDailyPlan, saveRecipe } = useRecipeStore()

  const handleRefresh = async () => {
    await fetch('/api/recipes/daily-plan', { method: 'POST' })
    await fetchDailyPlan()
    toast.success('Plan refreshed')
  }

  const handleSave = async (s: RecipeSuggestion) => {
    await saveRecipe(s.recipe)
    toast.success(`Saved "${s.recipe.name}"`)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="flex-1 h-px bg-base-300" />
        </div>
        {[1, 2].map(n => <div key={n} className="skeleton h-28 w-full rounded-2xl" />)}
      </div>
    )
  }

  if (!dailyPlan) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-semibold text-base-content/40 uppercase tracking-widest whitespace-nowrap">
          Today's suggestions
        </h2>
        <div className="flex-1 h-px bg-base-300" />
        <button onClick={handleRefresh}
          className="btn btn-ghost btn-xs gap-1.5 text-base-content/40 hover:text-base-content">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {MEAL_ORDER.map((mealType, i) => {
          const suggestions: RecipeSuggestion[] = dailyPlan[mealType] || []
          const top = suggestions[0]
          if (!top) return null

          return (
            <motion.div
              key={mealType}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card bg-base-100 border border-base-300 shadow-sm rounded-2xl"
            >
              <div className="card-body p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs">{MEAL_EMOJI[mealType]}</span>
                      <div className={`badge badge-sm badge-outline ${MEAL_BADGE[mealType]}`}>
                        {MEAL_LABELS[mealType]}
                      </div>
                      {top.uses_expiring && (
                        <div className="badge badge-sm badge-warning badge-outline">uses expiring</div>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-base-content leading-tight">
                      {top.recipe.name}
                    </h3>
                    <p className="text-xs text-base-content/50 mt-0.5 line-clamp-1">
                      {top.recipe.description}
                    </p>

                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-base-content/40">
                        <Clock size={10} strokeWidth={2} />
                        <span className="font-mono">{top.recipe.prep_time_minutes + top.recipe.cook_time_minutes}m</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <progress
                          className="progress progress-success w-14 h-1.5"
                          value={Math.round(top.match_score * 100)}
                          max={100}
                        />
                        <span className="text-[10px] font-mono text-base-content/40">
                          {Math.round(top.match_score * 100)}%
                        </span>
                      </div>
                    </div>

                    {top.missing_ingredients.length > 0 && (
                      <p className="text-[10px] font-mono text-base-content/30 mt-1.5">
                        Need: {top.missing_ingredients.map(i => i.name).slice(0, 3).join(', ')}
                        {top.missing_ingredients.length > 3 && ` +${top.missing_ingredients.length - 3} more`}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => handleSave(top)}
                      className="btn btn-ghost btn-sm btn-square rounded-xl border border-base-200" title="Save">
                      <BookmarkPlus size={14} strokeWidth={1.75} />
                    </button>
                    <a href={`/cook?recipe_name=${encodeURIComponent(top.recipe.name)}&description=${encodeURIComponent(top.recipe.description)}`}
                      className="btn btn-ghost btn-sm btn-square rounded-xl border border-base-200" title="Cook">
                      <ChevronRight size={14} strokeWidth={1.75} />
                    </a>
                  </div>
                </div>

                {suggestions.length > 1 && (
                  <p className="text-[10px] font-mono text-base-content/30 pt-2 border-t border-base-200 mt-1">
                    {suggestions.length - 1} more {mealType} option{suggestions.length > 2 ? 's' : ''} available
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
