import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Client-side Supabase instance. Uses the public anon key only - RLS
 * policies (supabase/migrations/0002_rls.sql) are what actually keep
 * students/teachers scoped to their own data, so this client is safe to
 * ship to the browser.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
