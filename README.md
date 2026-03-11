# Larder — Household Pantry Manager

A Next.js 14 PWA for two people to manage their household pantry (fridge, freezer, cupboards), log usage, and get AI-generated daily meal suggestions.

## Stack

- **Framework**: Next.js 14 App Router
- **Database**: Supabase (Postgres)
- **AI**: Anthropic Claude Sonnet (server-side only)
- **State**: Zustand stores
- **Styling**: Tailwind CSS + Framer Motion
- **Scanning**: @zxing/browser (client-side barcode) + Open Food Facts API
- **Voice**: Web Speech API (browser-native)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env.local`
   - Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from your [Supabase project](https://supabase.com/dashboard) (Settings → API).
   - Set `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com).
   - `NEXT_PUBLIC_APP_URL` can stay `http://localhost:3000` for local dev.

3. **Database**
   - **Option A (hosted Supabase):** Link the project then push migrations:
     ```bash
     npx supabase login
     npx supabase link --project-ref YOUR_PROJECT_REF
     npx supabase db push
     ```
   - **Option B:** Run the SQL in `supabase/migrations/001_initial_schema.sql` manually in the Supabase SQL editor.

4. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) (or the port shown if 3000 is in use).

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start dev server           |
| `npm run build`| Production build           |
| `npm run start`| Run production build       |
| `npm run lint` | Run ESLint                 |
| `npm run db:push` | Push Supabase migrations (after `supabase link`) |
| `npm run db:generate` | Regenerate DB types to `src/types/database.ts` |

## Project details

See **CLAUDE.md** for file structure, design decisions, and important rules for development.
