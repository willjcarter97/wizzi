import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { interpretPantryUpdate, enrichScannedProduct } from '@/lib/claude'

// GET /api/pantry — returns all pantry items ordered by location then name
export async function GET() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .order('location')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/pantry — adds a new item
// Body can come from:
//   - barcode scan (with product data from Open Food Facts)
//   - manual entry
//   - voice/text input (interpreted by Claude)
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const body = await req.json()

  // If this is a scanned product, enrich it with Claude before saving
  if (body.from_scan) {
    const enriched = await enrichScannedProduct(
      body.name,
      body.brand,
      body.quantity_string,
      body.categories
    )

    const { data, error } = await supabase
      .from('pantry_items')
      .insert([{
        ...enriched,
        barcode: body.barcode,
        brand: body.brand,
        image_url: body.image_url,
      }])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  // Direct insert for manual or pre-structured entries
  const { data, error } = await supabase
    .from('pantry_items')
    .insert([body])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
