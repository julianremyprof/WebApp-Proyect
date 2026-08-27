import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PublicLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createServerSupabaseClient();

  // RLS policy "activities: public practices readable by students" scopes
  // this to status = 'published' AND visibility = 'public_students'
  // automatically - no extra filtering needed for access control here.
  let query = supabase
    .from("activities")
    .select("id, title, kind, topics(title, competences(type))")
    .eq("status", "published")
    .eq("visibility", "public_students")
    .order("title");

  if (q) query = query.ilike("title", `%${q}%`);

  const { data: activities } = await query;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Public Practice Library</h1>
      <p className="mb-6 text-sm text-slate-500">
        Practices any teacher has made available to all students.
      </p>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search topics, e.g. Conditionals"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </form>

      {activities?.length ? (
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="card flex items-center justify-between !p-4">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {/* @ts-expect-error joined relation typed loosely for Phase 1 */}
                  {a.topics?.competences?.type ?? "General"} · {a.topics?.title ?? "—"}
                </p>
              </div>
              <Link href={`/practice/${a.id}`} className="btn-primary !px-3 !py-1.5 text-sm">
                Start
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          {q ? `No public practices match "${q}".` : "No public practices available yet."}
        </p>
      )}
    </main>
  );
}
