"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(searchParams.get("next") ?? "/dashboard/student");
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "azure") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">Log in to ProLearnin6</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="Password"
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-2 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleOAuth("google")}
          className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Continue with Google
        </button>
        <button
          onClick={() => handleOAuth("azure")}
          className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Continue with Microsoft
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        No account? <a className="underline" href="/signup">Sign up</a>
      </p>
    </main>
  );
}
