import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client scoped to the signed-in user (uses the
 * request's auth cookies), for use in Server Components and Route
 * Handlers. RLS still applies - this is NOT the admin client.
 *
 * Reads env from `process.env`, which works both in local `next dev` (via
 * .env.local) and once deployed to Cloudflare Workers, because
 * wrangler.jsonc pins `compatibility_date` to 2025-04-01+, which makes
 * Worker vars/secrets available on `process.env` automatically.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render (not a Route Handler
            // or Server Action) - safe to ignore because middleware.ts
            // already refreshes the session cookie on every request.
          }
        },
      },
    },
  );
}
