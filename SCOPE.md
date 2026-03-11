# Larder — Project Scope

## What this is

A household PWA for two people to manage their pantry (fridge, freezer, cupboards, counter), log how food gets used, and get AI-generated daily meal suggestions based on what's actually in stock.

Two users: Will and Paquita. No accounts, no multi-household complexity. One shared pantry state.

---

## In scope

### Pantry management
- Add items by barcode scan, voice input, or manual form entry
- Items show a draggable fullness bar (0–100%) as the primary quantity interface
- Exact quantities stored in the database; fullness is derived from `quantity / max_quantity`
- Items grouped by location: fridge, freezer, cupboard, counter
- Expiry date tracking with a warning banner for items expiring within 3 days
- Product images pulled from Open Food Facts on barcode scan; category icon fallback if missing or broken

### Three usage actions
Every stock reduction goes through one of these explicitly:
- **Used** — drag the fullness bar down, or describe it by voice
- **Cooked** — pick a saved recipe or describe the meal; Claude previews ingredient deductions before anything is committed; user must confirm
- **Threw out** — removes the item and logs it as waste with an optional reason

### Voice input
- Uses browser Web Speech API (no external service, no cost)
- Transcription happens client-side; transcript sent to `/api/voice` where Claude interprets it
- Claude's interpretation shown as a preview before any changes are applied

### Barcode scanning
- Camera access via browser MediaDevices API
- Decoding via zxing-wasm (client-side, no external service)
- Product data from Open Food Facts (free, no API key required)
- Claude enriches the product data into a structured pantry item on the server

### Daily meal plan
- One plan generated per day, stored in the database
- Covers: breakfast, snack, lunch, dinner — three options each
- Prioritises items expiring within 3 days
- Takes saved recipes into account (things the household has cooked before rank higher)
- User can manually refresh the plan at any time
- Suggestions can be bookmarked to the recipe book

### Recipe book
- Saved recipes persist across sessions
- Tracks how many times each recipe has been cooked (`cook_count`)
- Recipes can be selected directly from the cook flow to auto-populate ingredient deductions
- Recipes can be removed

### Waste tracking
- Every `threw_out` action is logged with the item name, date, and optional reason
- Foundation is in place for a weekly waste pattern analysis (Claude reads the log and surfaces patterns) — not yet built into the UI

---

## Out of scope (for now)

- Multiple households or user accounts
- Native mobile app (iOS/Android) — it's a PWA, added to home screen via browser
- Push notifications — daily plan is visible when the app is opened, not pushed
- Shopping list generation — not in v1
- Nutritional tracking or calorie counting
- Integrations with supermarket delivery services
- Meal planning beyond a single day
- Any social or sharing features

---

## Tech decisions that are fixed

These were chosen deliberately and shouldn't be revisited without good reason:

| Decision | Rationale |
|---|---|
| Next.js 14 App Router | Consistent with Will's other projects (Noriba, Born Media) |
| Supabase | Already in use; `fullness` as a computed Postgres column keeps client logic simple |
| Zustand for client state | Lightweight; avoids prop drilling without the overhead of Redux |
| Web Speech API for voice | Free, works offline for transcription, no third-party dependency |
| zxing-wasm for scanning | Runs entirely in browser, no server round-trip for decoding |
| Open Food Facts | Free, no API key, massive database, images included |
| Claude Sonnet for AI | All AI calls server-side only, never exposed to the client |
| PWA (not native app) | No app store, works on both phones immediately via browser bookmark |

---

## Key rules that must not be broken

1. **The cook confirmation step is mandatory.** Claude always previews ingredient deductions; the user always confirms before anything is written. Never skip this.
2. **Claude API calls are server-side only.** Never import `@anthropic-ai/sdk` in a client component.
3. **`max_quantity` never auto-updates.** It is set once when an item is first added and represents what 100% full means for that item. Only the user can change it.
4. **Fullness is a computed Postgres column.** To update it, update `quantity`. Never write to `fullness` directly.
5. **All percentage values in the UI round up to the nearest whole number.**
6. **The app name is Larder.** Not "pantry app", not "food tracker".

---

## What "done" looks like for v1

- [ ] Both Will and Paquita can use the app on their phones via browser bookmark
- [ ] Scanning a barcode adds an item with image and details in under 10 seconds
- [ ] Voice input correctly interprets natural pantry updates ("used the last of the eggs")
- [ ] Daily meal plan appears each morning based on current stock
- [ ] Cooking a recipe deducts the right ingredients after a single confirmation tap
- [ ] Threw out items are logged and visible in the usage log
- [ ] Items expiring soon are clearly flagged
- [ ] Category icons display correctly for all manually added items

---

## What's built

| File / area | Status |
|---|---|
| Database schema (`001_initial_schema.sql`) | Done |
| TypeScript types (`src/types/index.ts`) | Done |
| Supabase client + server helpers | Done |
| Claude API helper (`src/lib/claude.ts`) | Done |
| Open Food Facts helper | Done |
| Zustand pantry store | Done |
| Zustand recipe store | Done |
| API: `GET/POST /api/pantry` | Done |
| API: `PATCH/DELETE /api/pantry/[id]` | Done |
| API: `POST /api/scan` | Done |
| API: `POST /api/voice` | Done |
| API: `GET/POST /api/recipes/daily-plan` | Done |
| API: `POST /api/recipes/cook` | Done |
| Home page (`/`) | Done |
| Cook page (`/cook`) | Done |
| Recipe book page (`/recipes`) | Done |
| Header component | Done |
| Bottom action bar | Done |
| Pantry grid (grouped by location) | Done |
| Pantry item card with fullness bar | Done |
| Fullness bar (draggable) | Done |
| Usage actions sheet (used / cooked / threw out) | Done |
| Add item sheet (manual + post-scan) | Done |
| Expiry alert banner | Done |
| Daily plan strip | Done |
| Barcode scanner (camera + zxing) | Done |
| Voice input (Web Speech API) | Done |
| Category icon fallback system | Done |
| PWA manifest | Done |
| `CLAUDE.md` for Claude Code context | Done |
| Waste analysis UI | Not started |
| Shopping list | Out of scope v1 |
