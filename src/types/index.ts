// ─── Core pantry types ───────────────────────────────────────────────────────

export type PantryLocation = 'fridge' | 'freezer' | 'cupboard' | 'spice_rack'
export type PantryUnit = 'g' | 'kg' | 'ml' | 'l' | 'units' | 'tbsp' | 'tsp' | 'cups' | 'portions'
export type UsageAction = 'cooked' | 'threw_out' | 'used'
export type DailyPlanSlot = 'breakfast' | 'snack' | 'lunch' | 'dinner'

export interface PantryItem {
  id: string
  name: string
  brand?: string
  barcode?: string
  location: PantryLocation
  quantity: number          // actual quantity
  max_quantity: number      // full quantity (for fullness bar)
  unit: PantryUnit
  fullness: number          // 0–1 computed from quantity/max_quantity
  category: string          // e.g. "dairy", "grains", "produce"
  expiry_date?: string      // ISO date string
  image_url?: string        // from Open Food Facts
  notes?: string
  added_at: string
  updated_at: string
  low_stock_threshold: number  // fullness below this = amber warning
}

export interface UsageLog {
  id: string
  pantry_item_id: string
  pantry_item_name: string  // denormalised for log readability
  action: UsageAction
  quantity_change: number   // negative for reductions
  reason?: string           // e.g. "expired", "made pasta"
  recipe_id?: string        // linked recipe if action = cooked
  logged_at: string
  logged_by: string         // user display name
}

// ─── Recipe types ────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string
  quantity: number
  unit: PantryUnit
  pantry_item_id?: string   // linked if we have it in stock
  optional: boolean
}

export interface Recipe {
  id: string
  name: string
  description: string
  meal_type: MealCategory
  prep_time_minutes: number
  cook_time_minutes: number
  servings: number
  ingredients: RecipeIngredient[]
  instructions: string[]
  tags: string[]
  image_url?: string
  source_url?: string
  ai_generated: boolean
  saved_at: string
  last_cooked?: string
  cook_count: number
}

export interface RecipeSuggestion {
  recipe: Recipe
  match_score: number        // 0–1, how many ingredients we have
  missing_ingredients: RecipeIngredient[]
  uses_expiring: boolean     // true if it uses something about to expire
}

// ─── Daily plan ──────────────────────────────────────────────────────────────

export interface DailyPlan {
  id: string
  date: string
  breakfast: RecipeSuggestion[]
  snack: RecipeSuggestion[]
  lunch: RecipeSuggestion[]
  dinner: RecipeSuggestion[]
  generated_at: string
}

// Re-export for backwards compat with daily plan components
export type MealType = DailyPlanSlot

// ─── Scan types ──────────────────────────────────────────────────────────────

export interface BarcodeResult {
  barcode: string
  product?: OpenFoodFactsProduct
}

export interface OpenFoodFactsProduct {
  name: string
  brand?: string
  image_url?: string
  categories: string[]
  quantity_string?: string  // e.g. "1L", "500g"
  nutriscore?: string
}

// ─── Meal finder types ──────────────────────────────────────────────────────

export type MealCategory = 'snack' | 'quick' | 'proper' | 'batch'

export interface MealFinderResult {
  recipe_name: string
  origin: string
  why_authentic: string
  ingredients_have: RecipeIngredient[]
  ingredients_need: RecipeIngredient[]
  instructions: string[]
  prep_time_minutes: number
  cook_time_minutes: number
  servings: number
  tags: string[]
  source_note: string
  image_search_term?: string
  image_url?: string
}

// ─── Store / state types ─────────────────────────────────────────────────────

export interface PantryStore {
  items: PantryItem[]
  isLoading: boolean
  error: string | null
  fetchItems: () => Promise<void>
  addItem: (item: Omit<PantryItem, 'id' | 'added_at' | 'updated_at' | 'fullness'>) => Promise<void>
  updateFullness: (id: string, fullness: number) => Promise<void>
  logUsage: (log: Omit<UsageLog, 'id' | 'logged_at'>) => Promise<void>
  removeItem: (id: string) => Promise<void>
}

export interface RecipeStore {
  savedRecipes: Recipe[]
  dailyPlan: DailyPlan | null
  isLoading: boolean
  fetchSavedRecipes: () => Promise<void>
  fetchDailyPlan: () => Promise<void>
  saveRecipe: (recipe: Recipe) => Promise<void>
  updateRecipe: (id: string, updates: Partial<Recipe>) => Promise<void>
  removeRecipe: (id: string) => Promise<void>
}
