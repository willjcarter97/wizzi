import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateDailyPlan } from '@/lib/claude'
import type { PantryItem, Recipe } from '@/types'

// POST /api/recipes/daily-plan — generates (or regenerates) today's meal plan.
// Called automatically if no plan exists for today, or manually by the user.
export async function POST() {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  // Fetch current pantry state
  const { data: pantryItems } = await supabase
    .from('pantry_items')
    .select('*')

  // Fetch saved recipes so Claude can prioritise ones the household already likes
  const { data: savedRecipes } = await supabase
    .from('recipes')
    .select('*')
    .order('cook_count', { ascending: false })
    .limit(20)

  const plan = await generateDailyPlan(
    (pantryItems as PantryItem[]) || [],
    (savedRecipes as Recipe[]) || []
  )

  // Upsert into daily_plans — if today's plan already exists, overwrite it
  const { data, error } = await supabase
    .from('daily_plans')
    .upsert([{
      date: today,
      breakfast: plan.breakfast || [],
      snack: plan.snack || [],
      lunch: plan.lunch || [],
      dinner: plan.dinner || [],
      generated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET /api/recipes/daily-plan — returns today's plan if it exists
export async function GET() {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('date', today)
    .single()

  if (error || !data) {
    return NextResponse.json({ message: 'No plan for today yet' }, { status: 404 })
  }

  return NextResponse.json(data)
}
