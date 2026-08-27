"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Suggestion {
  id: string;
  message: string;
  status: "new" | "under_review" | "planned" | "completed";
  created_at: string;
}

const STATUS_LABEL: Record<Suggestion["status"], string> = {
  new: "New",
  under_review: "Under review",
  planned: "Planned",
  completed: "Completed",
};

const STATUS_COLOR: Record<Suggestion["status"], string> = {
  new: "bg-slate-100 text-slate-600",
  under_review: "bg-amber-50 text-amber-700",
  planned: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
};

export default function StudentSuggestionsPage() {
  const supabase = createClient();
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("student_suggestions")
      .select("id, message, status, created_at")
      .order("created_at", { ascending: false });
    setSuggestions((data as Suggestion[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("student_suggestions").insert({ student_id: user.id, message: message.trim() });
    setMessage("");
    setSubmitting(false);
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Suggestions</h1>
      <p className="mb-6 text-sm text-slate-500">
        Want a topic, activity, or idea added to ProLearnin6? Let your teachers know.
      </p>

      <form onSubmit={handleSubmit} className="card mb-8 flex flex-col gap-3">
        <textarea
          required
          rows={3}
          placeholder="e.g. Could we get more practices on the Second Conditional?"
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" disabled={submitting} className="btn-primary self-start">
          {submitting ? "Sending..." : "Send suggestion"}
        </button>
      </form>

      <h2 className="mb-3 font-semibold">Your suggestions</h2>
      {suggestions.length ? (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <li key={s.id} className="card !p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
                <span className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm">{s.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No suggestions yet.</p>
      )}
    </main>
  );
}
