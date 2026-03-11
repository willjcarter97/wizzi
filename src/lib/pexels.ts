// ─── Pexels image search ─────────────────────────────────────────────────────
// Free API for high-quality food photography. Used server-side only.
// Requires PEXELS_API_KEY in environment variables.
// https://www.pexels.com/api/documentation/

const PEXELS_API_KEY = process.env.PEXELS_API_KEY

const PLACEHOLDER_IMAGE = 'https://worldfoodtour.co.uk/wp-content/uploads/2013/06/neptune-placeholder-48.jpg'

interface PexelsPhoto {
  id: number
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    landscape: string
  }
  alt: string
  photographer: string
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[]
  total_results: number
}

/**
 * Search Pexels for a food image matching the search term.
 * The search term should ideally come from Claude's image_search_term field
 * (e.g. "BLT sandwich", "tacos al pastor"), which is far more accurate than
 * trying to regex-clean a full recipe name.
 *
 * Returns a medium-sized image URL, or the placeholder if nothing found.
 */
export async function searchRecipeImage(searchTerm: string): Promise<string> {
  if (!PEXELS_API_KEY) {
    console.warn('PEXELS_API_KEY not set - using placeholder')
    return PLACEHOLDER_IMAGE
  }

  const query = searchTerm.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
  if (!query) return PLACEHOLDER_IMAGE

  try {
    const result = await pexelsSearch(query)
    if (result) return result

    // Fallback: try just the first 2 words
    const simpler = query.split(' ').slice(0, 2).join(' ')
    if (simpler && simpler !== query) {
      const fallback = await pexelsSearch(simpler)
      if (fallback) return fallback
    }

    return PLACEHOLDER_IMAGE
  } catch (err) {
    console.error('Pexels image search failed:', err)
    return PLACEHOLDER_IMAGE
  }
}

async function pexelsSearch(query: string): Promise<string | null> {
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '3')
  url.searchParams.set('orientation', 'landscape')

  const res = await fetch(url.toString(), {
    headers: { Authorization: PEXELS_API_KEY! },
    next: { revalidate: 86400 },
  })

  if (!res.ok) {
    console.error(`Pexels API error: ${res.status}`)
    return null
  }

  const data: PexelsSearchResponse = await res.json()
  return data.photos[0]?.src.medium ?? null
}
