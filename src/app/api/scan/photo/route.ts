import { NextRequest, NextResponse } from 'next/server'
import { identifyProductFromPhoto } from '@/lib/claude'

// POST /api/scan/photo
// Body: { images: string[] }  — array of data URLs like "data:image/jpeg;base64,/9j/4AAQ..."
// Also accepts legacy { image: string } for backward compatibility.
// Returns structured pantry item fields inferred from the photo(s).
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Normalize: accept both { image: "..." } and { images: ["..."] }
  const rawImages: string[] = body.images
    ? body.images
    : body.image
      ? [body.image]
      : []

  if (rawImages.length === 0) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 })
  }

  // Parse each data URL into { base64, mediaType }
  const parsed = rawImages.map((img: string) => {
    if (!img?.startsWith('data:image/')) return null
    const [header, base64Data] = img.split(',')
    const mediaType = header.match(/data:(image\/[^;]+)/)?.[1] as
      | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      | undefined
    if (!base64Data || !mediaType) return null
    return { base64: base64Data, mediaType }
  })

  const validImages = parsed.filter(Boolean) as Array<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }>

  if (validImages.length === 0) {
    return NextResponse.json({ error: 'Could not parse image data' }, { status: 400 })
  }

  const result = await identifyProductFromPhoto(validImages)
  return NextResponse.json(result)
}
