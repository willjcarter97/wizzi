import { create } from 'zustand'
import { useRecipeStore } from './recipes'
import type { MealCategory, MealFinderResult } from '@/types'

type AddMode = 'ai' | 'paste' | 'link'

interface MealsStore {
  mode: AddMode
  category: MealCategory | null
  query: string
  pasteText: string
  linkUrl: string
  result: MealFinderResult | null
  isSearching: boolean
  error: string | null
  recentFinds: MealFinderResult[]
  setMode: (mode: AddMode) => void
  setCategory: (cat: MealCategory | null) => void
  setQuery: (q: string) => void
  setPasteText: (t: string) => void
  setLinkUrl: (u: string) => void
  findMeal: () => Promise<void>
  parseFromText: () => Promise<void>
  parseFromPhoto: (imageDataUrl: string) => Promise<void>
  parseFromLink: () => Promise<void>
  clearResult: () => void
  saveResultAsRecipe: () => Promise<void>
  showRecent: (find: MealFinderResult) => void
  loadRecentFinds: () => void
}

async function persistRecent(result: MealFinderResult) {
  try {
    await fetch('/api/recipes/recent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    })
  } catch {
    // Non-critical — don't block the UI
  }
}

export const useMealsStore = create<MealsStore>((set, get) => ({
  mode: 'ai',
  category: null,
  query: '',
  pasteText: '',
  linkUrl: '',
  result: null,
  isSearching: false,
  error: null,
  recentFinds: [],

  setMode: (mode) => set({ mode }),
  setCategory: (cat) => set({ category: cat }),
  setQuery: (q) => set({ query: q }),
  setPasteText: (t) => set({ pasteText: t }),
  setLinkUrl: (u) => set({ linkUrl: u }),

  loadRecentFinds: async () => {
    try {
      const res = await fetch('/api/recipes/recent')
      if (res.ok) {
        const data = await res.json()
        set({ recentFinds: data })
      }
    } catch {
      // Silent fail — recent finds are non-critical
    }
  },

  findMeal: async () => {
    const { category, query } = get()
    set({ isSearching: true, error: null, result: null })

    try {
      const res = await fetch('/api/meals/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, query }),
      })
      if (!res.ok) throw new Error('Failed to find recipe')
      const data = await res.json()
      set({ result: data })
      // Persist in background, then refresh the list
      persistRecent(data).then(() => get().loadRecentFinds())
    } catch {
      set({ error: 'Something went wrong - try again' })
    } finally {
      set({ isSearching: false })
    }
  },

  parseFromText: async () => {
    const { pasteText } = get()
    if (!pasteText.trim()) return
    set({ isSearching: true, error: null, result: null })

    try {
      const res = await fetch('/api/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      if (!res.ok) throw new Error('Failed to parse recipe')
      const data = await res.json()
      set({ result: data })
      persistRecent(data).then(() => get().loadRecentFinds())
    } catch {
      set({ error: 'Could not parse that recipe - try reformatting or pasting just the ingredients and steps' })
    } finally {
      set({ isSearching: false })
    }
  },

  parseFromPhoto: async (imageDataUrl: string) => {
    set({ isSearching: true, error: null, result: null })

    try {
      const res = await fetch('/api/recipes/parse-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl }),
      })
      if (!res.ok) throw new Error('Failed to read recipe from photo')
      const data = await res.json()
      set({ result: data })
      persistRecent(data).then(() => get().loadRecentFinds())
    } catch {
      set({ error: 'Could not read recipe from that photo - try again with better lighting or paste the text instead' })
    } finally {
      set({ isSearching: false })
    }
  },

  parseFromLink: async () => {
    const { linkUrl } = get()
    if (!linkUrl.trim()) return
    set({ isSearching: true, error: null, result: null })

    try {
      const fetchRes = await fetch('/api/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl }),
      })
      if (!fetchRes.ok) throw new Error('Failed to fetch recipe from URL')
      const data = await fetchRes.json()
      set({ result: data })
      persistRecent(data).then(() => get().loadRecentFinds())
    } catch {
      set({ error: 'Could not fetch that URL - check the link and try again' })
    } finally {
      set({ isSearching: false })
    }
  },

  clearResult: () => set({ result: null, error: null }),

  showRecent: (find) => set({ result: find }),

  saveResultAsRecipe: async () => {
    const { result, category } = get()
    if (!result) return

    const allIngredients = [
      ...result.ingredients_have,
      ...result.ingredients_need,
    ]

    const recipe = {
      id: crypto.randomUUID(),
      name: result.recipe_name,
      description: `${result.origin} - ${result.why_authentic}`,
      meal_type: category || ('proper' as MealCategory),
      prep_time_minutes: result.prep_time_minutes,
      cook_time_minutes: result.cook_time_minutes,
      servings: result.servings,
      ingredients: allIngredients,
      instructions: result.instructions,
      tags: result.tags,
      image_url: result.image_url,
      ai_generated: true,
      saved_at: new Date().toISOString(),
      cook_count: 0,
      origin: result.origin,
      country_flag: result.country_flag,
    }

    await useRecipeStore.getState().saveRecipe(recipe)
  },
}))
