"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Exclude<UserRole, "admin">>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Sign up failed.");
      setLoading(false);
      return;
    }

    // Super Admin accounts are never created through this form - they're
    // provisioned directly in the database (see docs/CLOUDFLARE_DEPLOY.md,
    // "Creating the first admin").
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, role, full_name: fullName });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (role === "student") {
      await supabase.from("student_profiles").insert({ profile_id: data.user.id });
    } else {
      await supabase.from("teacher_profiles").insert({ profile_id: data.user.id });
    }

    setLoading(false);
    router.push(role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex rounded-lg border border-slate-300 p-1">
          {(["student", "teacher"] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 rounded-md py-1.5 text-sm capitalize ${
                role === r ? "bg-brand-600 text-white" : "text-slate-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <input
          required
          placeholder="Full name"
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
          minLength={8}
          placeholder="Password"
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account? <a className="underline" href="/login">Log in</a>
      </p>
    </main>
  );
}
