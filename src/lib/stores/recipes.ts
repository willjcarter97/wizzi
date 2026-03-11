import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { Recipe, RecipeStore, DailyPlan } from '@/types'

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  savedRecipes: [],
  dailyPlan: null,
  isLoading: false,

  fetchSavedRecipes: async () => {
    set({ isLoading: true })
    const supabase = createClient()

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('saved_at', { ascending: false })

    if (!error && data) {
      set({ savedRecipes: data as Recipe[] })
    }

    set({ isLoading: false })
  },

  fetchDailyPlan: async () => {
    set({ isLoading: true })
    const supabase = createClient()

    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('date', today)
      .single()

    if (!error && data) {
      set({ dailyPlan: data as DailyPlan })
    } else {
      const res = await fetch('/api/recipes/daily-plan', { method: 'POST' })
      if (res.ok) {
        const plan = await res.json()
        set({ dailyPlan: plan })
      }
    }

    set({ isLoading: false })
  },

  saveRecipe: async (recipe: Recipe) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('recipes')
      .upsert([recipe])

    if (error) {
      console.error('Failed to save recipe:', error.message, error.details)
      throw new Error(error.message)
    }

    set(state => ({
      savedRecipes: [recipe, ...state.savedRecipes.filter(r => r.id !== recipe.id)],
    }))
  },

  updateRecipe: async (id: string, updates: Partial<Recipe>) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('recipes')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Failed to update recipe:', error.message, error.details)
      throw new Error(error.message)
    }

    set(state => ({
      savedRecipes: state.savedRecipes.map(r =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }))
  },

  removeRecipe: async (id: string) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)

    if (!error) {
      set(state => ({
        savedRecipes: state.savedRecipes.filter(r => r.id !== id),
      }))
    }
  },
}))
