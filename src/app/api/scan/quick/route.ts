import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// POST /api/scan/quick — parse a short free-text description like
// "whole avocado", "500ml oat milk", "6 eggs" into structured pantry item data.
export async function POST(req: NextRequest) {
  const { text } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: `You are a pantry management assistant. Parse a short free-text description of a food item into structured data.

Examples:
- "whole avocado" → name: "Avocado", quantity: 1, max_quantity: 1, unit: "units", location: "spice_rack", category: "produce"
- "500ml oat milk" → name: "Oat Milk", quantity: 500, max_quantity: 500, unit: "ml", location: "fridge", category: "dairy"
- "6 eggs" → name: "Eggs", quantity: 6, max_quantity: 6, unit: "units", location: "fridge", category: "dairy"
- "half a loaf of bread" → name: "Bread", quantity: 0.5, max_quantity: 1, unit: "units", location: "spice_rack", category: "bakery"
- "bag of frozen peas" → name: "Frozen Peas", quantity: 900, max_quantity: 900, unit: "g", location: "freezer", category: "frozen"
- "Lurpak butter" → name: "Butter", brand: "Lurpak", quantity: 250, max_quantity: 250, unit: "g", location: "fridge", category: "dairy"

Return a JSON object:
{
  "name": "Clean product name (capitalised, no brand)",
  "brand": "Brand if mentioned, otherwise empty string",
  "quantity": number,
  "max_quantity": number (same as quantity unless they said "half" etc),
  "unit": "g" | "kg" | "ml" | "l" | "units" | "tbsp" | "tsp" | "cups" | "portions",
  "location": "fridge" | "freezer" | "cupboard" | "spice_rack",
  "category": "dairy" | "grains" | "produce" | "condiments" | "snacks" | "meat" | "frozen" | "drinks" | "bakery" | "canned" | "spices" | "other"
}

Use typical UK supermarket sizes when the user doesn't specify quantity (e.g. milk=2000ml, butter=250g, eggs=6).
Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [{ role: 'user', content: text.trim() }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'

  try {
    const data = JSON.parse(raw)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
