import { NextRequest, NextResponse } from 'next/server'
import { identifyProductFromPhoto } from '@/lib/claude'

// POST /api/scan/photo
// Body: { image: string }  — a data URL like "data:image/jpeg;base64,/9j/4AAQ..."
// Returns structured pantry item fields inferred from the photo.
export async function POST(req: NextRequest) {
  const { image } = await req.json()

  if (!image?.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
  }

  // Split "data:image/jpeg;base64,<data>" → media type + raw base64
  const [header, base64Data] = image.split(',')
  const mediaType = header.match(/data:(image\/[^;]+)/)?.[1] as
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/gif'
    | undefined

  if (!base64Data || !mediaType) {
    return NextResponse.json({ error: 'Could not parse image data' }, { status: 400 })
  }

  const result = await identifyProductFromPhoto(base64Data, mediaType)
  return NextResponse.json(result)
}
