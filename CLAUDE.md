# Larder — Household Pantry Manager

A Next.js 14 PWA for two people to manage their household pantry (fridge, freezer, cupboards), 
log usage, and get AI-generated daily meal suggestions.

## Stack

- **Framework**: Next.js 14 App Router
- **Database**: Supabase (Postgres) — single `pantry` project
- **AI**: Anthropic Claude Sonnet (server-side only, via `/src/lib/claude.ts`)
- **State**: Zustand stores in `/src/lib/stores/`
- **Styling**: Tailwind CSS + Framer Motion
- **Scanning**: zxing-wasm (client-side barcode decoding) + Open Food Facts API
- **Voice**: Web Speech API (browser-native, client-side transcription)

## Running

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npx supabase db push         # run migrations
npm run dev
```

## Key design decisions

**Fullness bars, not raw numbers.** The primary UI for tracking stock is a draggable fullness bar (0–100%)
rather than exact grams or millilitres. This matches how people actually think about their pantry.
The DB stores actual quantity, and fullness is a computed column (quantity / max_quantity).

**Three usage actions.** Every stock reduction goes through one of three paths:
- `used` — drag the bar down, or voice input
- `cooked` — pick/describe a recipe, Claude previews deductions, user confirms
- `threw_out` — removes the item entirely and logs it as waste for pattern analysis

**Confirmation before cooking deductions.** Claude calculates what to deduct, but always shows a preview
before applying it. This prevents silent drift between pantry state and reality.

**Daily plan is generated fresh each morning.** Stored in `daily_plans` table with a unique constraint
on `date`. Can be manually refreshed by the user. Prioritises items expiring within 3 days.

## File structure

```
src/
  app/
    page.tsx              — Home: pantry grid + daily plan strip
    cook/page.tsx         — Log a cooked meal
    recipes/page.tsx      — Saved recipe book
    api/
      pantry/             — GET all items, POST add item
      pantry/[id]/        — PATCH update, DELETE remove
      scan/               — POST barcode lookup (Open Food Facts)
      voice/              — POST transcript → Claude → pantry updates
      recipes/daily-plan/ — GET/POST today's meal plan
      recipes/cook/       — POST preview/confirm recipe deductions
  components/
    pantry/
      PantryGrid          — Groups items by location (fridge/freezer/cupboard/counter)
      PantryItemCard      — Individual item with embedded fullness bar
      FullnessBar         — Draggable fill indicator, colour: green>50% amber>20% red
      UsageActionsSheet   — Bottom sheet: used / cooked / threw out
      AddItemSheet        — Add item form (post-scan or manual)
      ExpiryAlert         — Warning banner for items expiring within 3 days
    recipes/
      DailyPlanStrip      — Today's suggestions (one per meal type, bookmark to save)
    scanning/
      BarcodeScanner      — Full-screen camera + zxing decode loop
    voice/
      VoiceInput          — Record → transcribe → Claude → preview → confirm
    ui/
      Header              — App name, date, low-stock count
      BottomBar           — Scan / Voice / Cooked / Add actions
  lib/
    claude.ts             — All Anthropic API calls (server-side only)
    openfoodfacts.ts      — Barcode product lookup
    supabase/
      client.ts           — Browser Supabase client
      server.ts           — Server Supabase client + admin client
    stores/
      pantry.ts           — Zustand store for pantry items
      recipes.ts          — Zustand store for saved recipes + daily plan
  types/index.ts          — All shared TypeScript types
supabase/
  migrations/
    001_initial_schema.sql — Full DB schema with computed fullness column
```

## Important rules

1. Claude API calls only happen server-side (API routes). Never import `@anthropic-ai/sdk` in client components.
2. The `fullness` column in `pantry_items` is computed by Postgres. To update it, update `quantity`.
3. `max_quantity` is set when an item is first added (its starting quantity = 100% full). Never auto-update it.
4. All percentage values shown in the UI are rounded UP to the nearest whole number.
5. The cook flow always requires a confirmation step before deducting ingredients — never skip it.
6. Keep the voice + scan flows entirely client-side up to the API call. No server-side camera or microphone access.
