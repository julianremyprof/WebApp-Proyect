import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-4xl font-bold text-brand-700">ProLearnin6</h1>
        <p className="mt-3 text-slate-600">
          Practices, tests, and progress tracking for English classes — with
          coins, avatars, and badges along the way.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/login" className="btn-primary">
          Log in
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-lg border border-brand-600 px-4 py-2 font-medium text-brand-700 transition hover:bg-brand-50"
        >
          Create account
        </Link>
      </div>
      <Link href="/join" className="text-sm text-slate-500 underline underline-offset-4">
        Have a class code? Join a class
      </Link>
    </main>
  );
}
