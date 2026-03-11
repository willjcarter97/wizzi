import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseRecipeFromText } from '@/lib/claude'
import { searchRecipeImage } from '@/lib/pexels'
import type { PantryItem } from '@/types'

// POST /api/recipes/parse
// Body: { text?: string, url?: string }
// - text: raw pasted recipe text
// - url: link to a recipe page (will be fetched and scraped)
// Returns: parsed recipe in MealFinderResult format
export async function POST(req: NextRequest) {
  const body = await req.json()
  let { text } = body
  const { url } = body

  // If a URL was provided, fetch the page content
  if (url && !text) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WizziList/1.0; recipe-parser)',
          'Accept': 'text/html,application/xhtml+xml,text/plain',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        return NextResponse.json({ error: 'Could not fetch that URL' }, { status: 400 })
      }
      const html = await res.text()
      // Strip HTML tags for a rough plaintext extraction
      // Claude is good at parsing messy text, so this doesn't need to be perfect
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000) // Cap at 15k chars to stay within token limits
    } catch {
      return NextResponse.json({ error: 'Failed to fetch URL - check the link' }, { status: 400 })
    }
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No recipe text provided' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: pantryItems } = await supabase.from('pantry_items').select('*')

  try {
    const result = await parseRecipeFromText(
      text,
      (pantryItems as PantryItem[]) || []
    )

    // Use Claude's image_search_term if available, otherwise fall back to recipe name
    const image_url = await searchRecipeImage(result.image_search_term || result.recipe_name)

    return NextResponse.json({ ...result, image_url })
  } catch (err) {
    console.error('Recipe parse failed:', err)
    return NextResponse.json({ error: 'Failed to parse recipe' }, { status: 500 })
  }
}
