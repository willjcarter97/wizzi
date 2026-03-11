# Changelog

All notable changes to WizziList are documented here.
Format: `## YYYY-MM-DD — Summary`

---

## 2026-03-11 — Recent finds, detail view polish, smarter images

### Recent finds (token saving)
- **New Supabase table** `recent_finds` stores the last 5 AI search results as JSONB, deduped by recipe name.
- **New API route** `/api/recipes/recent` - GET returns last 5, POST upserts and prunes.
- **"Recent finds" section** on Add a recipe page - tap to instantly view a previous result without using API tokens.
- Persistence is non-blocking (fires in background after result is shown).
- **Migration:** Run `003_recent_finds.sql` in the Supabase SQL editor.

### Recipe detail modal - fixed header
- Hero image now stays fixed at top while content scrolls independently.
- Image fills full width (no horizontal gap), scrollbar contained within content area.
- Drag handle overlays the image instead of pushing it down.

### Meal finder result - detail view layout
- Result view now matches the recipe detail modal pattern: fixed hero image, scrollable content, fixed bottom toolbar.
- Bottom toolbar has "Back" and "Save to recipes" buttons, always visible.
- Full-screen layout with gradient overlay on hero image.

### Smarter image search via Claude
- Claude now returns an `image_search_term` field (e.g. "BLT sandwich", "cacio e pepe pasta") for targeted Pexels searches.
- API routes use `image_search_term` instead of the full recipe name, producing far more relevant images.
- Removed heavy regex cleanup from `pexels.ts` - Claude's term is more accurate.

### Recipe page overflow fix
- Removed `overflow-x-auto` from filter tabs (was causing horizontal scrollbar).
- Replaced with `flex-wrap` for natural tab layout.

## 2026-03-11 — Fix AI search accuracy, image relevance

### AI search respects user requests
- **Problem:** Searching for "BLT" returned a club sandwich with avocado because Claude was forcing pantry items into the recipe instead of respecting the user's request.
- **Fix:** Added CRITICAL RULE to `findAuthenticRecipe` prompt in `claude.ts` - pantry list is ONLY for splitting ingredients into "have" vs "need to buy", never for changing the requested recipe.

### Image search improvements
- **Problem:** Image searches were too specific (e.g. "Tacos de Bistec estilo Sonora food dish") returning irrelevant Pexels results.
- **Fix:** New `toImageQuery()` in `pexels.ts` strips parentheticals, regional terms ("estilo X", "from X"), and adjectives ("classic", "traditional") before searching. Falls back to first 1-2 words if no results.
- **Sequential search:** `/api/meals/find` now waits for the recipe name from Claude before searching Pexels (was searching in parallel with the raw user query).

### Placeholder fallback image
- `searchRecipeImage` now always returns a URL (never null) - uses placeholder image as final fallback when Pexels has no results or API key is missing.

## 2026-03-11 — Fix recipe save, image editing

### Recipe save bug fix
- **Root cause:** DB constraint on `meal_type` column only allowed `breakfast|snack|lunch|dinner`, but code now sends `snack|quick|proper|batch`. The `saveRecipe` function silently swallowed the Supabase error.
- **Fix:** Updated `001_initial_schema.sql` to use new categories for fresh installs. `saveRecipe` and `updateRecipe` now throw on error instead of silently failing. Save button in meals page catches and toasts the error.
- **Action needed:** Run migration 002 if you haven't already: `npx supabase db push` or run `002_update_meal_type_categories.sql` in the Supabase SQL editor.

### Image editing in recipe editor
- **Image field** added to edit modal with three options: paste a URL directly, click "Find" to search Pexels by recipe name, or remove the current image.
- **New API route** `/api/recipes/image` - GET endpoint that takes `?q=recipe+name` and returns a Pexels image URL.
- Image preview shown inline in the editor with a remove (X) button.

## 2026-03-11 — Add recipe page, scaling, editing, recipe import

### Add a recipe page (formerly "Find a recipe")
- **Renamed** "Find a recipe" to "Add a recipe" with three input modes via tabbed UI:
  - **AI search** - existing flow (category cards + free text)
  - **Paste recipe** - paste raw recipe text from anywhere (blogs, messages, notes), Claude parses it
  - **From link** - enter a URL to a recipe page, server fetches and parses it
- **New API route** `/api/recipes/parse` - accepts `text` or `url`, fetches/strips HTML if URL, sends to Claude for structured extraction
- **New Claude function** `parseRecipeFromText` in `claude.ts` - extracts structured recipe from messy text
- Loading states show context-appropriate messages per mode

### Recipe book - scaling
- **Servings scaler** in detail modal - +/- buttons to scale portions up or down
- All ingredient quantities update in real time based on scale multiplier
- Shows "Scaled from X (x2)" label when scaled
- Intelligent quantity rounding via `scaleQty` helper

### Recipe book - editing
- **Full edit modal** accessible via pencil icon in hero or Edit button in actions
- Editable fields: name, description, prep/cook time, servings, meal type, all ingredients (add/remove), all instructions (add/remove/reorder)
- Saves to Supabase via new `updateRecipe` method on recipe store
- Edit modal renders at z-60 to layer above the detail modal

### Claude prompt improvements
- **No em dashes** - added formatting rule to all recipe-generating prompts: "NEVER use em dashes or en dashes. Use hyphens (-) or commas instead."
- Applied to `findAuthenticRecipe`, `generateDailyPlan`, and `parseRecipeFromText`

## 2026-03-11 — Recipe categories, images, styling fixes

### Category alignment & nav
- **Unified recipe categories:** `snack | quick | proper | batch` used everywhere (meal search, recipe book filters, saved recipes, Claude prompts). Replaced old time-of-day types (`breakfast | lunch | dinner`).
- **Nav rename:** "Meals" → "Recipes", "Recipes" → "Saved" in bottom bar.
- **Batch cook** now 10 portions (was 4–8) in both UI and Claude prompt.
- **DB migration:** Added `002_update_meal_type_categories.sql` to update constraint and migrate existing rows.
- **Type refactor:** Created `DailyPlanSlot` for daily plan time slots, `MealCategory` for recipe categorization. `Recipe.meal_type` now uses `MealCategory`.
- **`saveResultAsRecipe`** now uses the selected category instead of hardcoding `'dinner'`.

### Meal search UX
- **Auto-search on category tap** — selecting a category immediately triggers the recipe search, no need to also press the button.
- **Fixed fieldset styling** — replaced DaisyUI v5 `fieldset`/`fieldset-legend`/`fieldset-label` classes (not available in v4) with plain Tailwind.
- **Fixed divider text sizing** — "or describe what you fancy" now uses `text-[10px]` to fit on one line.

### Recipe images
- **Recipe images via Pexels:** Added `src/lib/pexels.ts` — searches Pexels API for food photography. Runs server-side in parallel with Claude.
- **Meals finder images:** `/api/meals/find` returns `image_url`, carried through when saving.
- **Recipe book restyle:** Real food photos replace gradient+emoji thumbnails. Image hero in detail modal. Filter tabs match meal search categories.
- **Env:** Added `PEXELS_API_KEY` to `.env.example`.

### Housekeeping
- **Changelog & task tracking:** Added TASKS.md for progress tracking.

## Prior — App fully operational

The following work was completed across earlier sessions (consolidated):

### Branding & theming
- Renamed app from **Larder** to **WizziList**
- Switched to **DaisyUI** custom theme (`wizzilist`) — light palette with blue primary (#2563eb) and orange accent (#f97316)
- Fonts: **Plus Jakarta Sans** (body) + **Fira Mono** (data/labels)
- White card-based UI with subtle gray borders and shadows

### Core features (all working)
- **Pantry grid** — items grouped by location (fridge, freezer, cupboard, counter)
- **Fullness bars** — draggable, colour-coded (green → amber → red)
- **Usage actions** — used / cooked / threw out via bottom sheet
- **Add item** — manual entry or barcode scan
- **Barcode scanning** — zxing-wasm client-side decode + Open Food Facts lookup
- **Photo scan** — quick item add via camera (`/api/scan/photo`, `/api/scan/quick`)
- **Voice input** — Web Speech API transcription → Claude processing
- **Cook flow** — recipe selection → Claude previews deductions → user confirms
- **Daily meal plan** — AI-generated, stored per date, prioritises expiring items
- **Recipes page** — saved recipe book
- **Meals page** — meal discovery via `/api/meals/find`
- **Expiry alerts** — warning banner for items expiring within 3 days

### Infrastructure
- **Supabase** connected (Postgres DB with computed `fullness` column)
- **Anthropic Claude** server-side integration (`/src/lib/claude.ts`)
- **Zustand** stores for pantry, recipes, and meals state
- **PWA** manifest configured
- Build compiles cleanly (`npm run build`)

### Initial setup (2025-03-11)
- Fixed missing `@zxing/browser` dependency
- Added `@/*` path alias in tsconfig
- Added Web Speech API type declarations (`src/global.d.ts`)
- Fixed CategoryIcon Lucide type compatibility
