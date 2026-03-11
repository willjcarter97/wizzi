import { NextRequest, NextResponse } from 'next/server'
import { fetchProductByBarcode } from '@/lib/openfoodfacts'

// POST /api/scan — receives a barcode string decoded client-side by zxing-wasm
// and returns the matched product from Open Food Facts.
// Enrichment into a PantryItem happens in /api/pantry POST with from_scan: true.
export async function POST(req: NextRequest) {
  const { barcode } = await req.json()

  if (!barcode?.trim()) {
    return NextResponse.json({ error: 'No barcode provided' }, { status: 400 })
  }

  const product = await fetchProductByBarcode(barcode)

  if (!product) {
    return NextResponse.json({
      found: false,
      barcode,
      message: 'Product not found in Open Food Facts — please enter details manually',
    })
  }

  return NextResponse.json({ found: true, barcode, product })
}
