"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Suggestion {
  id: string;
  message: string;
  status: "new" | "under_review" | "planned" | "completed";
  created_at: string;
  student_id: string;
  profiles: { full_name: string } | null;
}

const STATUSES: Suggestion["status"][] = ["new", "under_review", "planned", "completed"];

export default function TeacherSuggestionsPage() {
  const supabase = createClient();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  async function load() {
    // RLS policy "suggestions: teacher reads all" grants read access to
    // every student's suggestions here (student_suggestions has no
    // per-teacher ownership - it's a shared inbox, matching spec §18's
    // "keep this simple" instruction rather than routing by class).
    const { data } = await supabase
      .from("student_suggestions")
      .select("id, message, status, created_at, student_id, profiles(full_name)")
      .order("created_at", { ascending: false });
    setSuggestions((data as unknown as Suggestion[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, status: Suggestion["status"]) {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await supabase.from("student_suggestions").update({ status }).eq("id", id);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Student suggestions</h1>

      {suggestions.length ? (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <li key={s.id} className="card !p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{s.profiles?.full_name ?? "Student"}</span>
                <span className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              <p className="mb-3 text-sm">{s.message}</p>
              <select
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={s.status}
                onChange={(e) => updateStatus(s.id, e.target.value as Suggestion["status"])}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace("_", " ")}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No suggestions submitted yet.</p>
      )}
    </main>
  );
}
