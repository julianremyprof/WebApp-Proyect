"use client";

import { useState } from "react";
import { CSV_TEMPLATES, type ImportableType } from "@/lib/csv/templates";
import { parseCsv, type ImportSummary } from "@/lib/csv/parse";
import { createClient } from "@/lib/supabase/client";

export default function ImportActivityPage() {
  const supabase = createClient();
  const [type, setType] = useState<ImportableType>("fill_in_blank");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  function downloadTemplate() {
    const template = CSV_TEMPLATES[type];
    const blob = new Blob([template.toCsvString()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSummary(parseCsv(type, text));
    setSavedCount(null);
  }

  async function saveToQuestionBank() {
    if (!summary?.valid.length) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("questions").insert(
      summary.valid.map((row) => ({
        owner_id: user.id,
        type,
        prompt: row.prompt,
        data: row.data,
        is_public: false,
      })),
    );

    setSaving(false);
    if (!error) setSavedCount(summary.valid.length);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Import activity from CSV</h1>

      <div className="card mb-6">
        <label className="mb-2 block text-sm font-medium">1. Choose activity type</label>
        <select
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2"
          value={type}
          onChange={(e) => {
            setType(e.target.value as ImportableType);
            setSummary(null);
            setSavedCount(null);
          }}
        >
          {Object.values(CSV_TEMPLATES).map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={downloadTemplate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            2. Download {CSV_TEMPLATES[type].label} template
          </button>
          <label className="btn-primary cursor-pointer text-sm">
            3. Upload filled-in CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
        </div>
      </div>

      {summary && (
        <div className="card mb-6">
          <h2 className="mb-3 font-semibold">
            4. Preview — {summary.valid.length} valid, {summary.invalid.length} with errors
          </h2>

          {summary.invalid.length > 0 && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p className="mb-1 font-medium">Fix these rows and re-upload:</p>
              <ul className="list-inside list-disc">
                {summary.invalid.map((r) => (
                  <li key={r.row}>
                    Row {r.row}: {r.errors.join(" ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {summary.valid.map((r) => (
              <li key={r.row} className="border-b border-slate-100 pb-2">
                {r.prompt}
              </li>
            ))}
          </ul>

          <button
            onClick={saveToQuestionBank}
            disabled={saving || summary.valid.length === 0}
            className="btn-primary mt-4"
          >
            {saving ? "Saving..." : `5. Save ${summary.valid.length} questions to Question Bank`}
          </button>

          {savedCount != null && (
            <p className="mt-3 text-sm text-emerald-600">
              Saved {savedCount} questions. Add them to an activity from the Question Bank.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
