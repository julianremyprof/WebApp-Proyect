import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely -
 * only ever import this inside Route Handlers / Server Actions that
 * perform their own explicit authorization check first (e.g. verifying
 * the caller is the activity owner before writing a grade, or is an
 * admin before moderating public content).
 *
 * Never import this into a Client Component or anything that ships to
 * the browser. SUPABASE_SERVICE_ROLE_KEY is a runtime secret (see
 * .dev.vars.example / docs/CLOUDFLARE_DEPLOY.md) and must never be
 * exposed as a NEXT_PUBLIC_* variable.
 */
export function createAdminSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .dev.vars locally, " +
        "or `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` in production.",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}
