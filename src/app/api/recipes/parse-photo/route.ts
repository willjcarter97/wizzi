import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseRecipeFromPhoto } from '@/lib/claude'
import { searchRecipeImage } from '@/lib/pexels'
import type { PantryItem } from '@/types'

// POST /api/recipes/parse-photo
// Body: { image: "data:image/jpeg;base64,..." }
// Returns: parsed recipe in MealFinderResult format
export async function POST(req: NextRequest) {
  const { image } = await req.json()

  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  // Parse data URL to extract media type and base64 data
  const match = image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
  if (!match) {
    return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
  }

  const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  const base64Data = match[3]

  const supabase = createServerSupabaseClient()
  const { data: pantryItems } = await supabase.from('pantry_items').select('*')

  try {
    const result = await parseRecipeFromPhoto(
      base64Data,
      mediaType,
      (pantryItems as PantryItem[]) || []
    )

    const image_url = await searchRecipeImage(result.image_search_term || result.recipe_name)

    return NextResponse.json({ ...result, image_url })
  } catch (err) {
    console.error('Recipe photo parse failed:', err)
    return NextResponse.json({ error: 'Failed to read recipe from photo' }, { status: 500 })
  }
}
