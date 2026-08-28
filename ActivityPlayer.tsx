"use client";

import { useMemo, useState } from "react";
import type { ClientQuestion } from "@/lib/engines/sanitize";

interface Props {
  activityId: string;
  title: string;
  kind: "practice" | "test";
  questions: ClientQuestion[];
  randomize: boolean;
  coinRewardsEnabled: boolean;
}

type ResponseMap = Record<string, unknown>;

interface AttemptResult {
  scorePercent: number;
  passed: boolean;
  coinsAwarded: number;
  tierReached: 1 | 2 | 3 | null;
  perQuestion: Array<{ questionId: string; isCorrect: boolean | null }>;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function ActivityPlayer({
  activityId,
  title,
  kind,
  questions,
  randomize,
  coinRewardsEnabled,
}: Props) {
  const ordered = useMemo(() => (randomize ? shuffle(questions) : questions), [questions, randomize]);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setBlank(questionId: string, value: string) {
    setResponses((prev) => ({ ...prev, [questionId]: { blank_values: [value] } }));
  }

  function setChoice(questionId: string, optionId: string) {
    setResponses((prev) => ({ ...prev, [questionId]: { selected_option_ids: [optionId] } }));
  }

  function setBool(questionId: string, value: boolean) {
    setResponses((prev) => ({ ...prev, [questionId]: { answer: value } }));
  }

  function setMatch(questionId: string, leftId: string, rightValue: string) {
    setResponses((prev) => {
      const existing = (prev[questionId] as { matches: Record<string, string> } | undefined)?.matches ?? {};
      return { ...prev, [questionId]: { matches: { ...existing, [leftId]: rightValue } } };
    });
  }

  function setWordOrder(questionId: string, words: string[]) {
    setResponses((prev) => ({ ...prev, [questionId]: { ordered_words: words } }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityId,
        answers: ordered.map((q) => ({ questionId: q.id, response: responses[q.id] ?? null })),
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong submitting your attempt.");
      return;
    }

    setResult(await res.json());
  }

  if (result) {
    return (
      <div className="card text-center">
        <h1 className="mb-2 text-2xl font-semibold">{title} — Results</h1>
        <p className="mb-4 text-4xl font-bold text-brand-600">{Math.round(result.scorePercent)}%</p>
        <p className="mb-4 text-slate-600">{result.passed ? "You passed! 🎉" : "Keep practicing — you can do this."}</p>
        {coinRewardsEnabled && result.coinsAwarded > 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-amber-700">
            +{result.coinsAwarded} coin{result.coinsAwarded === 1 ? "" : "s"}
            {result.tierReached ? ` (Tier ${result.tierReached})` : ""}
          </p>
        )}
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  const answeredCount = Object.keys(responses).length;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">{title}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {kind === "practice" ? "Practice" : "Test"} · {ordered.length} questions · {answeredCount}/{ordered.length}{" "}
        answered
      </p>

      <div className="space-y-4">
        {ordered.map((q, i) => (
          <div key={q.id} className="card">
            <p className="mb-3 font-medium">
              {i + 1}. {q.prompt}
            </p>

            {q.type === "fill_in_blank" && (
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Type your answer"
                onChange={(e) => setBlank(q.id, e.target.value)}
              />
            )}

            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {(q.render.options as Array<{ id: string; text: string }>).map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      onChange={() => setChoice(q.id, opt.id)}
                    />
                    {opt.text}
                  </label>
                ))}
              </div>
            )}

            {q.type === "true_false" && (
              <div className="flex gap-3">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex items-center gap-1 text-sm">
                    <input type="radio" name={q.id} onChange={() => setBool(q.id, v)} />
                    {v ? "True" : "False"}
                  </label>
                ))}
              </div>
            )}

            {q.type === "matching" && (
              <div className="space-y-2">
                {(q.render.leftItems as Array<{ id: string; text: string }>).map((left) => (
                  <div key={left.id} className="flex items-center gap-3 text-sm">
                    <span className="w-40 shrink-0">{left.text}</span>
                    <select
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1"
                      defaultValue=""
                      onChange={(e) => setMatch(q.id, left.id, e.target.value)}
                    >
                      <option value="" disabled>
                        Choose a match...
                      </option>
                      {(q.render.rightItems as string[]).map((right) => (
                        <option key={right} value={right}>
                          {right}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {q.type === "word_order" && (
              <WordOrderInput words={q.render.words as string[]} onChange={(w) => setWordOrder(q.id, w)} />
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        className="btn-primary mt-6"
        disabled={submitting || answeredCount === 0}
        onClick={handleSubmit}
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}

/** Tap words in order to build the sentence; tap a chosen word to remove it. */
function WordOrderInput({ words, onChange }: { words: string[]; onChange: (ordered: string[]) => void }) {
  const [available, setAvailable] = useState(words);
  const [chosen, setChosen] = useState<string[]>([]);

  function pick(word: string, index: number) {
    const next = available.filter((_, i) => i !== index);
    setAvailable(next);
    const nextChosen = [...chosen, word];
    setChosen(nextChosen);
    onChange(nextChosen);
  }

  function unpick(index: number) {
    const word = chosen[index];
    const nextChosen = chosen.filter((_, i) => i !== index);
    setChosen(nextChosen);
    setAvailable([...available, word]);
    onChange(nextChosen);
  }

  return (
    <div>
      <div className="mb-2 flex min-h-[2.5rem] flex-wrap gap-2 rounded-lg border border-dashed border-slate-300 p-2">
        {chosen.length === 0 && <span className="text-sm text-slate-400">Tap words below in order</span>}
        {chosen.map((w, i) => (
          <button
            key={`${w}-${i}`}
            type="button"
            onClick={() => unpick(i)}
            className="rounded-md bg-brand-600 px-2 py-1 text-sm text-white"
          >
            {w}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {available.map((w, i) => (
          <button
            key={`${w}-${i}`}
            type="button"
            onClick={() => pick(w, i)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
