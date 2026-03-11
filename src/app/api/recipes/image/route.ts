import { NextRequest, NextResponse } from 'next/server'
import { searchRecipeImage } from '@/lib/pexels'

// GET /api/recipes/image?q=recipe+name
// Returns: { url: string | null }
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')

  if (!q?.trim()) {
    return NextResponse.json({ url: null })
  }

  const url = await searchRecipeImage(q)
  return NextResponse.json({ url })
}
