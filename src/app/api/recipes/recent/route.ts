import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const MAX_RECENT = 5

// GET /api/recipes/recent — fetch the last 5 finds
export async function GET() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('recent_finds')
    .select('recipe_name, result, created_at')
    .order('created_at', { ascending: false })
    .limit(MAX_RECENT)

  if (error) {
    console.error('Failed to fetch recent finds:', error.message)
    return NextResponse.json([])
  }

  return NextResponse.json(data.map(row => row.result))
}

// POST /api/recipes/recent — upsert a find
// Body: MealFinderResult
export async function POST(req: NextRequest) {
  const result = await req.json()
  const supabase = createServerSupabaseClient()

  // Upsert by recipe_name — updates the result and timestamp if it already exists
  const { error } = await supabase
    .from('recent_finds')
    .upsert(
      { recipe_name: result.recipe_name, result, created_at: new Date().toISOString() },
      { onConflict: 'recipe_name' }
    )

  if (error) {
    console.error('Failed to save recent find:', error.message, error.details, error.hint)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Prune old entries beyond MAX_RECENT
  const { data: all } = await supabase
    .from('recent_finds')
    .select('id')
    .order('created_at', { ascending: false })

  if (all && all.length > MAX_RECENT) {
    const idsToDelete = all.slice(MAX_RECENT).map(r => r.id)
    await supabase.from('recent_finds').delete().in('id', idsToDelete)
  }

  return NextResponse.json({ ok: true })
}
