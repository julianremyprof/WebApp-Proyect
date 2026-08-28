"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinClassPage() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=/join`);
      return;
    }

    // RLS policy "classes: students read by active code" only exposes
    // classes with code_active = true and allow_self_join = true, so an
    // inactive or disabled code simply won't be found here.
    const { data: klass, error: findError } = await supabase
      .from("classes")
      .select("id, name, code_active, allow_self_join")
      .eq("class_code", code.trim().toUpperCase())
      .maybeSingle();

    if (findError || !klass) {
      setStatus("error");
      setMessage("That class code isn't valid or isn't open for joining right now.");
      return;
    }

    const { error: joinError } = await supabase
      .from("class_memberships")
      .insert({ class_id: klass.id, student_id: user.id });

    if (joinError) {
      setStatus("error");
      setMessage(joinError.message.includes("duplicate") ? "You're already in this class." : joinError.message);
      return;
    }

    setStatus("success");
    setMessage(`Joined ${klass.name}!`);
    setTimeout(() => router.push("/dashboard/student"), 1000);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold">Join a class</h1>
      <p className="mb-6 text-sm text-slate-500">Enter the code your teacher gave you.</p>
      <form onSubmit={handleJoin} className="flex flex-col gap-4">
        <input
          required
          placeholder="e.g. ENG10A-7Q2"
          className="rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-wide"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {message && (
          <p className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-600"}`}>{message}</p>
        )}
        <button type="submit" disabled={status === "loading"} className="btn-primary">
          {status === "loading" ? "Joining..." : "Join class"}
        </button>
      </form>
    </main>
  );
}
