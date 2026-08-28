import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function StudentDashboard() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: studentProfile }, { data: recentAttempts }, { data: badgeAwards }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("student_profiles").select("coin_balance").eq("profile_id", user.id).single(),
      supabase
        .from("attempts")
        .select("id, activity_id, score_percent, submitted_at, activities(title)")
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(5),
      supabase
        .from("badge_awards" as never)
        .select("badge_id, badges(name, icon_url)")
        .eq("student_id", user.id)
        .order("awarded_at", { ascending: false })
        .limit(5),
    ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="text-2xl font-semibold">{profile?.full_name ?? "Student"}</h1>
        </div>
        <div className="card flex items-center gap-2 !p-3">
          <span className="text-coin">🪙</span>
          <span className="font-semibold">{studentProfile?.coin_balance ?? 0}</span>
          <span className="text-sm text-slate-500">coins</span>
        </div>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-semibold">Recent scores</h2>
          {recentAttempts?.length ? (
            <ul className="space-y-3">
              {recentAttempts.map((a) => (
                // @ts-expect-error - joined relation typed loosely for Phase 1
                <li key={a.id} className="flex items-center justify-between text-sm">
                  {/* @ts-expect-error joined relation */}
                  <span>{a.activities?.title ?? "Activity"}</span>
                  <span className="font-medium">
                    {a.score_percent != null ? `${Math.round(a.score_percent)}%` : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No attempts yet — try a practice below.</p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold">Recent badges</h2>
          {badgeAwards?.length ? (
            <ul className="space-y-2 text-sm">
              {badgeAwards.map((b, i) => (
                // @ts-expect-error joined relation typed loosely for Phase 1
                <li key={i}>{b.badges?.name}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No badges yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Word Formation Practice</h2>
        <p className="mb-4 text-sm text-slate-500">
          40 fill-in-the-blank questions. Earn coins based on your score.
        </p>
        <div className="flex gap-3">
          <Link href="/practice/word-formation" className="btn-primary">
            Start practice
          </Link>
          <Link
            href="/practices/library"
            className="inline-flex items-center rounded-lg border border-brand-600 px-4 py-2 text-brand-700 hover:bg-brand-50"
          >
            Browse public library
          </Link>
          <Link
            href="/suggestions"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50"
          >
            Suggestions
          </Link>
        </div>
      </section>
    </main>
  );
}
