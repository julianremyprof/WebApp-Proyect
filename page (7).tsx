import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ScoreByActivityChart from "@/components/charts/ScoreByActivityChart";

export default async function TeacherDashboard() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: classes }, { data: activities }, { data: attempts }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("teacher_id", user.id),
    supabase.from("activities").select("id, title, status").eq("owner_id", user.id),
    supabase
      .from("attempts")
      .select("id, activity_id, student_id, score_percent, submitted_at, activities!inner(owner_id, title)")
      .eq("activities.owner_id", user.id),
  ]);

  const studentCount = await supabase
    .from("class_memberships")
    .select("student_id", { count: "exact", head: true })
    .in("class_id", (classes ?? []).map((c) => c.id));

  const completed = (attempts ?? []).filter((a) => a.score_percent != null);
  const avgScore = completed.length
    ? completed.reduce((sum, a) => sum + (a.score_percent ?? 0), 0) / completed.length
    : null;

  const byActivity = new Map<string, { title: string; scores: number[] }>();
  for (const a of completed) {
    // @ts-expect-error joined relation typed loosely for Phase 1
    const title = a.activities?.title ?? "Activity";
    const entry = byActivity.get(a.activity_id) ?? { title, scores: [] };
    entry.scores.push(a.score_percent ?? 0);
    byActivity.set(a.activity_id, entry);
  }
  const chartData = [...byActivity.values()].map((e) => ({
    name: e.title,
    average: Math.round(e.scores.reduce((s, v) => s + v, 0) / e.scores.length),
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Teacher dashboard</h1>
        <div className="flex gap-3">
          <Link href="/classes/new" className="btn-primary">
            New class
          </Link>
          <Link
            href="/activities/import"
            className="inline-flex items-center rounded-lg border border-brand-600 px-4 py-2 text-brand-700 hover:bg-brand-50"
          >
            Import CSV
          </Link>
          <Link
            href="/dashboard/teacher/suggestions"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50"
          >
            Suggestions
          </Link>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Classes" value={classes?.length ?? 0} />
        <StatCard label="Students" value={studentCount.count ?? 0} />
        <StatCard label="Activities" value={activities?.length ?? 0} />
        <StatCard label="Avg. score" value={avgScore != null ? `${Math.round(avgScore)}%` : "—"} />
      </section>

      <section className="card mb-8">
        <h2 className="mb-4 font-semibold">Average score by activity</h2>
        {chartData.length ? (
          <ScoreByActivityChart data={chartData} />
        ) : (
          <p className="text-sm text-slate-500">No submitted attempts yet.</p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Your classes</h2>
        {classes?.length ? (
          <ul className="divide-y divide-slate-100">
            {classes.map((c) => (
              <li key={c.id} className="py-2 text-sm">
                {c.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            No classes yet.{" "}
            <Link href="/classes/new" className="underline">
              Create your first class
            </Link>
            .
          </p>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card !p-4 text-center">
      <p className="text-2xl font-semibold text-brand-700">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
