import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { findAuthenticRecipe } from '@/lib/claude'
import { searchRecipeImage } from '@/lib/pexels'
import type { PantryItem } from '@/types'

// POST /api/meals/find
// Body: { category: string, query: string }
// Returns: MealFinderResult (with image_url from Pexels)
export async function POST(req: NextRequest) {
  const { category, query } = await req.json()

  if (!query?.trim() && !category) {
    return NextResponse.json({ error: 'Provide a category or describe what you want' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: pantryItems } = await supabase.from('pantry_items').select('*')

  // Get the recipe first, then search for an image using the actual recipe name
  const result = await findAuthenticRecipe(
    category || 'proper',
    query || category || '',
    (pantryItems as PantryItem[]) || []
  )

  // Use Claude's image_search_term if available, otherwise fall back to recipe name
  const image_url = await searchRecipeImage(result.image_search_term || result.recipe_name)

  return NextResponse.json({ ...result, image_url })
}
