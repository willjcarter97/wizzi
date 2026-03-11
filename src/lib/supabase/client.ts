import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase instance. Safe to use in components and hooks.
// createBrowserClient handles cookie-based session management automatically.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
