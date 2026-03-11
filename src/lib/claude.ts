import Anthropic from '@anthropic-ai/sdk'
import type { PantryItem, Recipe, RecipeSuggestion, DailyPlanSlot } from '@/types'

// Single shared Anthropic client. Only ever instantiated server-side.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ─── Pantry interpretation ────────────────────────────────────────────────────

// Interprets a free-text or voice input like "used about half the olive oil"
// and returns structured update instructions for the pantry.
export async function interpretPantryUpdate(
  input: string,
  currentItems: PantryItem[]
): Promise<{
  action: 'update' | 'add' | 'remove'
  item_name: string
  pantry_item_id?: string
  quantity_change?: number
  fullness_override?: number
  reason?: string
}[]> {
  const itemsContext = currentItems
    .map(i => `- ${i.name} (id: ${i.id}, fullness: ${Math.round(i.fullness * 100)}%, location: ${i.location})`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You are a pantry management assistant. Given a user's natural language input 
about pantry changes and a list of current pantry items, return a JSON array of update 
instructions. Each instruction has:
- action: "update" | "add" | "remove"
- item_name: string (human readable)
- pantry_item_id: string (match to existing item id if possible, otherwise omit)
- quantity_change: number (negative for reduction, positive for addition — in the item's native unit)
- fullness_override: number 0–1 (if the user says "half full", "nearly gone", "full" etc)
- reason: string (optional, e.g. "expired", "cooked pasta")

Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Current pantry items:\n${itemsContext}\n\nUser input: "${input}"`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  return JSON.parse(text)
}

// ─── Recipe suggestions ───────────────────────────────────────────────────────

// Given current pantry state, generates a daily meal plan with suggestions
// for breakfast, snack, lunch, and dinner. Prioritises items close to expiry.
export async function generateDailyPlan(
  pantryItems: PantryItem[],
  savedRecipes: Recipe[]
): Promise<Record<DailyPlanSlot, RecipeSuggestion[]>> {
  // Build a clear, concise context for the model. Highlight expiring items.
  const today = new Date()
  const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

  const pantryContext = pantryItems
    .map(item => {
      const expiring = item.expiry_date && new Date(item.expiry_date) <= threeDays
      return `- ${item.name} (${Math.round(item.fullness * 100)}% full, ${item.location})${expiring ? ' ⚠️ EXPIRING SOON' : ''}`
    })
    .join('\n')

  const savedContext = savedRecipes.length
    ? `\nSaved recipes the user likes:\n${savedRecipes.map(r => `- ${r.name} (${r.meal_type})`).join('\n')}`
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You are a helpful home cooking assistant. Given a household's current pantry,
suggest a daily meal plan. Prioritise items that are expiring soon.
NEVER use em dashes or en dashes. Use hyphens (-) or commas instead. Use plain ASCII punctuation only.
Return a JSON object with keys: breakfast, snack, lunch, dinner.
Each key maps to an array of 3 RecipeSuggestion objects.

Each RecipeSuggestion has:
{
  recipe: {
    id: string (generate a uuid-style string),
    name: string,
    description: string,
    meal_type: "snack"|"quick"|"proper"|"batch",
    prep_time_minutes: number,
    cook_time_minutes: number,
    servings: 2,
    ingredients: [{ name, quantity, unit, optional: false }],
    instructions: [string],
    tags: [string],
    ai_generated: true,
    saved_at: "${new Date().toISOString()}",
    cook_count: 0
  },
  match_score: number 0–1 (fraction of ingredients available in pantry),
  missing_ingredients: [{ name, quantity, unit, optional }],
  uses_expiring: boolean
}

Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Pantry:\n${pantryContext}${savedContext}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── Recipe deduction ─────────────────────────────────────────────────────────

// When a user cooks a recipe (saved or described), this figures out exactly
// which pantry items to deduct and by how much.
export async function calculateRecipeDeductions(
  recipeDescription: string,
  pantryItems: PantryItem[]
): Promise<{
  item_id: string
  item_name: string
  quantity_change: number
  unit: string
}[]> {
  const pantryContext = pantryItems
    .map(i => `- id:${i.id} | ${i.name} | ${i.quantity}${i.unit} | ${i.location}`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You are a pantry management assistant. Given a recipe description and a pantry list, 
return a JSON array of ingredient deductions. Each item:
{
  item_id: string (match to pantry item id),
  item_name: string,
  quantity_change: number (NEGATIVE — amount used),
  unit: string
}

Only include items that exist in the pantry. If a quantity is ambiguous, make a reasonable estimate.
Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Recipe: "${recipeDescription}"\n\nPantry:\n${pantryContext}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  return JSON.parse(text)
}

// ─── Barcode product enrichment ───────────────────────────────────────────────

// After scanning a barcode and getting Open Food Facts data, this enriches
// the product into a properly structured PantryItem ready to be added.
export async function enrichScannedProduct(
  productName: string,
  brand?: string,
  quantityString?: string,
  categories?: string[]
): Promise<{
  name: string
  category: string
  location: 'fridge' | 'freezer' | 'cupboard' | 'counter'
  quantity: number
  max_quantity: number
  unit: string
}> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: `Given a food product, return a JSON object:
{
  name: string (clean product name, no brand),
  category: string (e.g. "dairy", "grains", "produce", "condiments", "snacks", "meat", "frozen"),
  location: "fridge" | "freezer" | "cupboard" | "counter" (most likely storage),
  quantity: number (initial quantity from quantity_string, or 1),
  max_quantity: number (same as quantity — it's just been added),
  unit: "g" | "kg" | "ml" | "l" | "units" | "tbsp" | "tsp" | "cups" | "portions"
}
Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Product: ${productName}${brand ? `, Brand: ${brand}` : ''}${quantityString ? `, Size: ${quantityString}` : ''}${categories?.length ? `, Categories: ${categories.join(', ')}` : ''}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── Photo product identification ────────────────────────────────────────────

// Accepts a base64-encoded image of a pantry item and returns structured data:
// name, brand, unit, max_quantity (standard package size from label), and a
// best-guess current_quantity (estimated from visible fill level / packaging).
export async function identifyProductFromPhoto(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<{
  name: string
  brand: string
  category: string
  location: 'fridge' | 'freezer' | 'cupboard' | 'counter'
  unit: string
  max_quantity: number
  current_quantity: number
  confidence: 'high' | 'medium' | 'low'
  notes: string
}> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: `You are a pantry management assistant with computer vision capabilities.
Analyse an image of a food/drink/pantry item and return a JSON object.

Rules:
- name: clean product name without brand (e.g. "Semi-skimmed Milk", not "Cravendale Semi-skimmed Milk")
- brand: brand name if visible, otherwise ""
- category: one of "dairy","grains","produce","condiments","snacks","meat","frozen","drinks","bakery","canned","spices","other"
- location: most likely storage location — "fridge" | "freezer" | "cupboard" | "counter"
- unit: best unit for this item — "g" | "kg" | "ml" | "l" | "units" | "tbsp" | "tsp" | "cups" | "portions"
- max_quantity: standard full/new package size in chosen unit (read from label if visible, otherwise use typical UK supermarket size)
- current_quantity: your best estimate of the CURRENT amount remaining, in the same unit. Look at fill level in transparent containers, or assume ~70% full if packaging is opaque and looks unopened, lower if it looks used.
- confidence: "high" if you can clearly read the label, "medium" if partially visible, "low" if guessing
- notes: one brief sentence explaining your quantity estimate

Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: 'Identify this pantry item and estimate its quantities.',
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── Authentic recipe finder ─────────────────────────────────────────────────

export async function findAuthenticRecipe(
  category: string,
  userQuery: string,
  pantryItems: PantryItem[]
): Promise<{
  recipe_name: string
  origin: string
  why_authentic: string
  ingredients_have: { name: string; quantity: number; unit: string; optional: boolean }[]
  ingredients_need: { name: string; quantity: number; unit: string; optional: boolean }[]
  instructions: string[]
  prep_time_minutes: number
  cook_time_minutes: number
  servings: number
  tags: string[]
  source_note: string
  image_search_term?: string
}> {
  const pantryContext = pantryItems
    .map(i => `- ${i.name} (${Math.round(i.fullness * 100)}% full, ${i.quantity}${i.unit}, ${i.location})`)
    .join('\n')

  const categoryDesc: Record<string, string> = {
    snack: 'A snack — something small but satisfying, 5-15 minutes max',
    quick: 'A quick meal — ready in under 30 minutes, minimal prep',
    proper: 'A proper sit-down meal — worth spending 30-90 minutes on',
    batch: 'A batch cook — makes 10 portions, designed for meal prep and freezing',
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a culinary researcher who finds SPECIFIC, AUTHENTIC, well-sourced recipes. You are NOT a generic meal planner.

CRITICAL RULE - RESPECT THE USER'S REQUEST:
- If the user asks for a specific dish (e.g. "BLT", "carbonara", "pad thai"), return EXACTLY that dish. Do NOT substitute a different recipe just because it uses more pantry items.
- The pantry list is provided ONLY so you can split ingredients into "have" vs "need to buy". It is NOT a constraint on what recipe to return.
- Never add extra ingredients to a recipe just because they are in the pantry. A BLT has bacon, lettuce, and tomato - not avocado just because they have one.
- Only when the user's request is vague (e.g. "something quick", "use up the chicken") should you factor in pantry contents when choosing the recipe.

YOUR MANDATE:
- Find a REAL recipe with a REAL name from a REAL culinary tradition. Never invent generic placeholder recipes.
- If the user says "BLT", return a proper BLT. If they say "beef tacos", find a specific style like "Tacos de Bistec estilo Sonora".
- If the user says "pasta", find something specific: "Pasta alla Norma (Catania, Sicily)" or "Cacio e Pepe (Roman)".
- For snacks, find real traditional snacks from world cuisines, not "apple slices with peanut butter".
- Every recipe MUST have a traceable culinary origin (region, country, tradition, or notable cookbook/chef).

QUALITY RULES:
1. The recipe name must be specific and cultural (include the original language name where natural).
2. Ingredients must be precise: "2 dried ancho chillies" not "chilli powder to taste".
3. Instructions must be detailed enough for a first-timer: include temperatures, visual cues, timing.
4. Cross-reference the user's pantry ONLY to split ingredients into "have" vs "need to buy". Do NOT change the recipe to match the pantry.
5. When matching pantry items, be generous: if they have "olive oil" and the recipe needs "extra virgin olive oil", count it as a match.
6. Adapt portion sizes to serve 2 people unless the category is batch cooking.

FORMATTING RULES:
- NEVER use em dashes or en dashes. Use hyphens (-) or commas instead.
- Use plain ASCII punctuation only.

Return a JSON object:
{
  "recipe_name": "Specific Recipe Name (Original Language if applicable)",
  "origin": "Region/City, Country or Tradition/Chef",
  "why_authentic": "1-2 sentences on what makes this the real deal",
  "ingredients_have": [{ "name": "...", "quantity": N, "unit": "...", "optional": false }],
  "ingredients_need": [{ "name": "...", "quantity": N, "unit": "...", "optional": false }],
  "instructions": ["Step 1...", "Step 2...", ...],
  "prep_time_minutes": N,
  "cook_time_minutes": N,
  "servings": 2,
  "tags": ["cuisine-tag", "method-tag", ...],
  "source_note": "Brief attribution, e.g. 'Adapted from Diana Kennedy, The Essential Cuisines of Mexico'",
  "image_search_term": "2-3 word food photography search term for this dish, e.g. 'BLT sandwich', 'tacos al pastor', 'cacio e pepe'. Must be visually specific to THIS dish."
}

Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Category: ${categoryDesc[category] || category}\n\nUser request: "${userQuery}"\n\nMy pantry:\n${pantryContext || '(empty pantry)'}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── Parse recipe from text/URL content ──────────────────────────────────────

// Takes raw text (pasted recipe, scraped webpage, etc.) and extracts a structured recipe.
export async function parseRecipeFromText(
  rawText: string,
  pantryItems: PantryItem[]
): Promise<{
  recipe_name: string
  origin: string
  why_authentic: string
  ingredients_have: { name: string; quantity: number; unit: string; optional: boolean }[]
  ingredients_need: { name: string; quantity: number; unit: string; optional: boolean }[]
  instructions: string[]
  prep_time_minutes: number
  cook_time_minutes: number
  servings: number
  tags: string[]
  source_note: string
  image_search_term?: string
}> {
  const pantryContext = pantryItems
    .map(i => `- ${i.name} (${Math.round(i.fullness * 100)}% full, ${i.quantity}${i.unit}, ${i.location})`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a recipe parser. Given raw text (a pasted recipe, blog post content, or scraped webpage), extract a clean, structured recipe.

RULES:
1. Extract the recipe name, ingredients, instructions, and metadata from the text.
2. If the text is messy (blog posts with life stories, ads, etc.), ignore the fluff and extract only the recipe.
3. Ingredients must be precise with quantities and units.
4. Instructions must be clear, numbered steps.
5. Cross-reference the user's pantry to split ingredients into "have" vs "need to buy".
6. When matching pantry items, be generous: if they have "olive oil" and the recipe needs "extra virgin olive oil", count it as a match.
7. If servings aren't mentioned, assume 2.
8. If times aren't mentioned, estimate based on the recipe complexity.
9. NEVER use em dashes or en dashes. Use hyphens (-) or commas instead.
10. Use plain ASCII punctuation only.

Return a JSON object:
{
  "recipe_name": "The recipe name as written",
  "origin": "Source or cuisine origin if identifiable",
  "why_authentic": "Brief note on the recipe",
  "ingredients_have": [{ "name": "...", "quantity": N, "unit": "...", "optional": false }],
  "ingredients_need": [{ "name": "...", "quantity": N, "unit": "...", "optional": false }],
  "instructions": ["Step 1...", "Step 2...", ...],
  "prep_time_minutes": N,
  "cook_time_minutes": N,
  "servings": N,
  "tags": ["cuisine-tag", "method-tag", ...],
  "source_note": "Where this recipe came from, if identifiable",
  "image_search_term": "2-3 word food photography search term for this dish"
}

Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Recipe text:\n${rawText}\n\nMy pantry:\n${pantryContext || '(empty pantry)'}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── Parse recipe from photo ─────────────────────────────────────────────────

// Takes a photo of a recipe (cookbook page, handwritten card, screenshot, etc.)
// and extracts a structured recipe using Claude vision.
export async function parseRecipeFromPhoto(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  pantryItems: PantryItem[]
): Promise<{
  recipe_name: string
  origin: string
  why_authentic: string
  ingredients_have: { name: string; quantity: number; unit: string; optional: boolean }[]
  ingredients_need: { name: string; quantity: number; unit: string; optional: boolean }[]
  instructions: string[]
  prep_time_minutes: number
  cook_time_minutes: number
  servings: number
  tags: string[]
  source_note: string
  image_search_term?: string
}> {
  const pantryContext = pantryItems
    .map(i => `- ${i.name} (${Math.round(i.fullness * 100)}% full, ${i.quantity}${i.unit}, ${i.location})`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a recipe parser with vision capabilities. Given a photo of a recipe (cookbook page, handwritten card, phone screenshot, magazine clipping, etc.), extract a clean, structured recipe.

RULES:
1. Read all visible text in the image - recipe name, ingredients, instructions, and any metadata.
2. If the image is partially obscured or blurry, do your best to infer the content.
3. Ingredients must be precise with quantities and units.
4. Instructions must be clear, numbered steps.
5. Cross-reference the user's pantry to split ingredients into "have" vs "need to buy".
6. When matching pantry items, be generous: if they have "olive oil" and the recipe needs "extra virgin olive oil", count it as a match.
7. If servings aren't mentioned, assume 2.
8. If times aren't mentioned, estimate based on the recipe complexity.
9. NEVER use em dashes or en dashes. Use hyphens (-) or commas instead.
10. Use plain ASCII punctuation only.

Return a JSON object:
{
  "recipe_name": "The recipe name as written",
  "origin": "Source or cuisine origin if identifiable",
  "why_authentic": "Brief note on the recipe",
  "ingredients_have": [{ "name": "...", "quantity": N, "unit": "...", "optional": false }],
  "ingredients_need": [{ "name": "...", "quantity": N, "unit": "...", "optional": false }],
  "instructions": ["Step 1...", "Step 2...", ...],
  "prep_time_minutes": N,
  "cook_time_minutes": N,
  "servings": N,
  "tags": ["cuisine-tag", "method-tag", ...],
  "source_note": "Where this recipe came from, if identifiable from the image",
  "image_search_term": "2-3 word food photography search term for this dish"
}

Return ONLY valid JSON. No prose. No markdown fences.`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `Extract the recipe from this image.\n\nMy pantry:\n${pantryContext || '(empty pantry)'}`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── Waste pattern analysis ───────────────────────────────────────────────────

// Analyses the usage log to surface waste patterns. Called weekly.
export async function analyseWastePatterns(
  throwOutLogs: { item_name: string; logged_at: string; reason?: string }[]
): Promise<string> {
  if (!throwOutLogs.length) return 'No waste logged yet.'

  const logsContext = throwOutLogs
    .map(l => `- ${l.item_name} thrown out on ${l.logged_at}${l.reason ? ` (${l.reason})` : ''}`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `You are a friendly household assistant. Analyse food waste logs and give 
2–4 concise, practical suggestions to reduce waste. Be direct, not preachy. 
Write in plain English, no bullet points, just short paragraphs.`,
    messages: [{ role: 'user', content: logsContext }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
