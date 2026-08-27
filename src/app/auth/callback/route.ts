import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data.user) {
      // First-time OAuth sign-in: create the profile row if it doesn't
      // exist yet, defaulting to student (teachers signing up via OAuth
      // can switch roles from account settings - see Phase 2 backlog).
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("profiles").insert({
          id: data.user.id,
          role: "student",
          full_name: data.user.user_metadata?.full_name ?? data.user.email ?? "New user",
        });
        await supabase.from("student_profiles").insert({ profile_id: data.user.id });
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard/student`);
}
