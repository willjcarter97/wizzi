import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { interpretPantryUpdate } from '@/lib/claude'
import type { PantryItem } from '@/types'

// POST /api/voice — receives transcribed text from the Web Speech API
// (transcription happens client-side, we just get the text here)
// Then uses Claude to interpret the intent and apply pantry updates.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { transcript } = await req.json()

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
  }

  // Fetch current pantry so Claude has context for matching items
  const { data: items } = await supabase
    .from('pantry_items')
    .select('*')

  const updates = await interpretPantryUpdate(transcript, (items as PantryItem[]) || [])

  if (!updates.length) {
    return NextResponse.json({ message: 'No pantry changes detected', updates: [] })
  }

  // Apply each update instruction
  const results = []

  for (const update of updates) {
    if (update.action === 'update' && update.pantry_item_id) {
      const item = (items as PantryItem[])?.find(i => i.id === update.pantry_item_id)

      if (item) {
        let newQuantity = item.quantity

        if (update.fullness_override !== undefined) {
          // User said something like "nearly gone" or "half full"
          newQuantity = update.fullness_override * item.max_quantity
        } else if (update.quantity_change !== undefined) {
          newQuantity = Math.max(0, item.quantity + update.quantity_change)
        }

        const { data, error } = await supabase
          .from('pantry_items')
          .update({ quantity: newQuantity })
          .eq('id', update.pantry_item_id)
          .select()
          .single()

        // Log the usage
        await supabase.from('usage_logs').insert([{
          pantry_item_id: update.pantry_item_id,
          pantry_item_name: item.name,
          action: 'used',
          quantity_change: newQuantity - item.quantity,
          reason: update.reason,
          logged_by: 'household',
        }])

        results.push({ success: !error, item_name: update.item_name, updated: data })
      }

    } else if (update.action === 'remove' && update.pantry_item_id) {
      const item = (items as PantryItem[])?.find(i => i.id === update.pantry_item_id)

      // Log as threw_out before deleting
      if (item) {
        await supabase.from('usage_logs').insert([{
          pantry_item_id: update.pantry_item_id,
          pantry_item_name: item.name,
          action: 'threw_out',
          quantity_change: -item.quantity,
          reason: update.reason,
          logged_by: 'household',
        }])
      }

      await supabase.from('pantry_items').delete().eq('id', update.pantry_item_id)
      results.push({ success: true, item_name: update.item_name, action: 'removed' })
    }
  }

  return NextResponse.json({ transcript, updates, results })
}
