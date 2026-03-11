import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calculateRecipeDeductions } from '@/lib/claude'
import type { PantryItem, Recipe } from '@/types'

// POST /api/recipes/cook — called when a user logs that they cooked something.
// Body:
//   - recipe_id?: string (if cooking a saved recipe)
//   - recipe_description?: string (if describing a one-off meal)
//   - confirmed: boolean (false = preview only, true = apply deductions)
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const body = await req.json()
  const { recipe_id, recipe_description, confirmed = false } = body

  // Fetch current pantry items
  const { data: pantryItems } = await supabase
    .from('pantry_items')
    .select('*')

  let descriptionForClaude = recipe_description

  // If we have a saved recipe, build the description from its ingredients list
  if (recipe_id) {
    const { data: recipe } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipe_id)
      .single()

    if (recipe) {
      const r = recipe as Recipe
      descriptionForClaude = `${r.name}: ${r.ingredients
        .map(i => `${i.quantity}${i.unit} ${i.name}`)
        .join(', ')}`
    }
  }

  if (!descriptionForClaude) {
    return NextResponse.json({ error: 'No recipe or description provided' }, { status: 400 })
  }

  // Ask Claude to figure out the deductions
  const deductions = await calculateRecipeDeductions(
    descriptionForClaude,
    (pantryItems as PantryItem[]) || []
  )

  // If the user hasn't confirmed yet, return the preview for them to check
  if (!confirmed) {
    return NextResponse.json({ preview: deductions, recipe_description: descriptionForClaude })
  }

  // User confirmed — apply all deductions
  const results = []

  for (const deduction of deductions) {
    const item = (pantryItems as PantryItem[])?.find(i => i.id === deduction.item_id)
    if (!item) continue

    const newQuantity = Math.max(0, item.quantity + deduction.quantity_change)

    const { error: updateError } = await supabase
      .from('pantry_items')
      .update({ quantity: newQuantity })
      .eq('id', deduction.item_id)

    if (!updateError) {
      await supabase.from('usage_logs').insert([{
        pantry_item_id: deduction.item_id,
        pantry_item_name: deduction.item_name,
        action: 'cooked',
        quantity_change: deduction.quantity_change,
        recipe_id: recipe_id || null,
        reason: `Cooked: ${recipe_description || 'saved recipe'}`,
        logged_by: 'household',
      }])

      results.push({ item_id: deduction.item_id, new_quantity: newQuantity })
    }
  }

  // Increment cook_count on the saved recipe if applicable
  if (recipe_id) {
    await supabase.rpc('increment_cook_count', { recipe_id })
  }

  return NextResponse.json({ success: true, deductions, results })
}
