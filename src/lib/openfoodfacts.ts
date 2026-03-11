import type { OpenFoodFactsProduct } from '@/types'

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product'

// Fetches product data from Open Food Facts by barcode (EAN-13 or similar).
// Returns null if the product isn't found or the API is unreachable.
export async function fetchProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const res = await fetch(`${OFF_BASE}/${barcode}.json`, {
      // Cache the lookup for 7 days — product data rarely changes
      next: { revalidate: 604800 },
    })

    if (!res.ok) return null

    const data = await res.json()

    if (data.status !== 1 || !data.product) return null

    const p = data.product

    return {
      name: p.product_name || p.product_name_en || 'Unknown product',
      brand: p.brands || undefined,
      image_url: p.image_url || p.image_front_url || undefined,
      categories: p.categories_tags
        ? p.categories_tags.map((c: string) => c.replace('en:', ''))
        : [],
      quantity_string: p.quantity || undefined,
      nutriscore: p.nutriscore_grade || undefined,
    }
  } catch {
    // Network error or parse failure — fail gracefully
    return null
  }
}
