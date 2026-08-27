# ProLearnin6

Interactive English-learning platform: practices, tests, coins, avatars,
badges, and teacher analytics — built as a real Next.js + Supabase app,
deployable on Cloudflare Workers' free plan.

> **Status: Phase 1 MVP.** This repository implements the Phase 1 slice
> defined in the product spec end-to-end and for real — a teacher can
> create a class, a student can join it, complete the seeded **Word
> Formation Practice** (40 fill-in-the-blank questions), get it
> auto-graded, earn coins under the exact tier logic, and the teacher can
> see the result on a real analytics dashboard. Multiple Choice, True/False
> and CSV import work end-to-end for those three types. Everything else in
> the spec (avatar shop, badges UI, matching/word-order/speaking engines,
> AI generation, public practice library browsing UI, etc.) has its full
> database schema and RLS policies already in place (see
> `supabase/migrations/0001_schema.sql`) so Phase 2/3 features are additive
> — no schema rewrites needed — but their UI is not yet built. See
> [Feature status](#feature-status) below for the exact breakdown.

## Tech stack

| Layer          | Choice                                              |
| -------------- | ---------------------------------------------------- |
| Framework      | Next.js 15 (App Router) + TypeScript                 |
| Deployment     | Cloudflare Workers, via the `@opennextjs/cloudflare` adapter |
| Database       | Supabase Postgres                                     |
| Auth           | Supabase Auth (email/password, Google, Microsoft)     |
| DB security    | Postgres Row Level Security (see `0002_rls.sql`)      |
| File storage   | Supabase Storage (audio/image uploads)                |
| Styling        | Tailwind CSS                                          |
| Charts         | Recharts                                              |
| CSV            | Papa Parse                                            |
| Forms          | React Hook Form + Zod                                 |

This is **not** built for Vercel specifically — there's no `output:
"export"`, no Vercel-only APIs, and the caching layer targets Cloudflare KV
instead of the filesystem. See [Deploying to Cloudflare](#deploying-prolearnin6-to-cloudflare-for-free)
below.

## Feature status

**Implemented (Phase 1):**
- Email/password auth + Google/Microsoft OAuth scaffolding, role-based
  signup (student/teacher), role-based route protection in `middleware.ts`
- Classes with generated join codes; student self-join by code
- Book → Unit → Lesson → Competence → Topic schema, seeded with a demo tree
- Fill in the Blank, Multiple Choice, and True/False question engines
  (`src/lib/engines/grading.ts`) with case-insensitive / whitespace-normalized
  grading
- The 40-question **Word Formation Practice**, seeded and fully playable
- Attempt history (append-only, never overwritten on retry)
- Exact coin tier-reward logic (`src/lib/coins.ts`, unit-testable pure
  function) wired to a real Postgres-backed reward-history table
- CSV import (template download → upload → validate → preview → save to
  Question Bank) for Multiple Choice, Fill in the Blank, and True/False
- Student dashboard (coins, recent scores, badges, practice launcher)
- Teacher dashboard (class/student/activity counts, average score by
  activity chart, class list)
- Full relational schema + RLS for every entity in the spec (classes,
  question bank, activities, assignments, attempts, coins, avatar system,
  badges, suggestions, content sharing, AI generation requests)

**Implemented (Phase 2 slice):**
- Matching and Word Order question engines (partial-credit grading for
  Matching, exact-order grading for Word Order), including CSV import
  templates/parsing and interactive UI (dropdown matching, tap-to-order
  word builder) in the activity player
- Public Practice Library: student-facing browse/search page for
  `public_students`-visibility practices
- Student Suggestions: submission form + status tracking for students,
  review/status-update page for teachers

**Schema ready, UI not yet built (remaining Phase 2/3 — see spec §30):**
- Drag & Drop, Short Answer, Essay, Listening, Image-based, Speaking
  engines
- Avatar customization + shop + inventory UI
- Badge creation/award UI (automatic badge triggers)
- Question Bank browse/search/organize UI, random activity generation
  from the bank, teacher content sharing UI
- AI-assisted activity generation and AI-assisted writing/speaking
  feedback (the `ai_generation_requests` table and a provider abstraction
  point exist; no provider is wired up — see `.dev.vars.example`)
- Super Admin console (the `admin` role and its RLS read-policies exist;
  no dedicated UI yet)

## Local development

```bash
npm install
cp .env.example .env.local        # fill in Supabase URL + anon key
cp .dev.vars.example .dev.vars    # fill in the same, plus the service role key
npm run dev
```

### Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the SQL editor, run the migrations in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_functions.sql`
   (Or, if you use the Supabase CLI: `supabase db push`.)
3. In **Authentication → Providers**, enable Google and/or Microsoft (Azure)
   if you want OAuth login; email/password works out of the box.
4. Copy **Project Settings → API → Project URL** and **anon public** key
   into `.env.local` / `.dev.vars`. Copy the **service_role** key into
   `.dev.vars` only (never `.env.local`, never anything `NEXT_PUBLIC_`).
5. Sign up one teacher account through the running app.
6. In `supabase/seed/0001_word_formation.sql`, replace `OWNER_EMAIL` with
   that teacher's email, then run the file in the SQL editor to seed the
   demo curriculum tree and the Word Formation Practice.

### Regenerating types

`src/types/database.ts` is currently hand-written for the tables Phase 1
touches. Once your schema is live, regenerate it properly:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts
```

Re-run this after every migration.

---

## Deploying ProLearnin6 to Cloudflare for Free

This uses Cloudflare's currently-recommended path for Next.js: the
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) adapter,
which converts a standard `next build` into a Cloudflare Worker. It's
already wired into this repo (`open-next.config.ts`, `wrangler.jsonc`,
the `cf:*` scripts in `package.json`).

### 0. What you'll need

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A free [Supabase project](https://supabase.com) (see setup above)
- This repo pushed to a GitHub repository
- Node.js 18.18+ locally (only needed if you want to deploy from your
  machine instead of via GitHub — Step 3 covers both)

### 1. Create the KV namespace for the Next.js cache

Cloudflare Workers have no filesystem, so the Next.js data/route cache
(ISR, fetch caching) is backed by Workers KV instead.

```bash
npx wrangler login
npx wrangler kv namespace create prolearnin6-cache
```

Copy the `id` it prints into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "NEXT_CACHE_WORKERS_KV", "id": "PASTE_THE_ID_HERE" }
]
```

### 2. Understand build-time vs. runtime variables (important)

This is the single most common Cloudflare + Next.js deployment mistake,
so it's worth being explicit:

| Variable | When it's needed | Where to set it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Build time** (inlined into the client bundle) *and* runtime | Cloudflare **Build variables** *and* Worker **Variables and Secrets** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build time *and* runtime | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime only (server routes) | Worker **Variables and Secrets**, encrypted, **never** as a build variable |
| `NEXT_PUBLIC_SITE_URL` | Build time | Cloudflare **Build variables** |

`NEXT_PUBLIC_*` variables get compiled into the JavaScript Next.js ships to
the browser, so they must exist *while `next build` runs*, not just at
request time. If you only set them as Worker runtime variables, the build
step won't see them and pages that need them at build time can fail or
ship with blank values. Set the `NEXT_PUBLIC_*` pair in **both** places to
be safe — build variables so `next build` succeeds, and runtime
variables/secrets so server-rendered routes (which also read
`process.env` in the Worker) have them too.

### 3. Connect the repo to Cloudflare (GitHub → automatic deploys)

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Connect
   to Git**.
2. Pick your GitHub repo and authorize Cloudflare's GitHub App if prompted.
3. Framework preset: choose **Next.js** if offered, or configure manually:
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
   - **Build output / worker directory:** left as default (`.open-next`)
4. Under **Settings → Build → Variables and secrets**, add the **build**
   variables from the table above (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`).
5. Click **Save and Deploy**. Cloudflare will run the build on every push
   to your default branch from now on (Workers Builds CI).

### 4. Configure Supabase variables at runtime

After the first deploy, go to your Worker → **Settings → Variables and
Secrets** and add the **runtime** entries:

- `NEXT_PUBLIC_SUPABASE_URL` (plain text — same value as the build variable)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plain text)
- `SUPABASE_SERVICE_ROLE_KEY` — click **Encrypt** for this one

Or from the CLI:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Redeploy (or trigger a new commit) after adding runtime variables so the
Worker picks them up.

### 5. Deploying from your local machine instead (optional)

If you'd rather not use GitHub CI, you can build and deploy directly:

```bash
npm install
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

`npm run cf:preview` runs the equivalent build + a local Wrangler preview
first, which is worth doing before every deploy: it runs the app in an
actual `workerd` runtime locally, which catches Node-API-only code that
would otherwise only fail in production.

### 6. Verify it's live

Cloudflare gives you a free `https://prolearnin6.<your-subdomain>.workers.dev`
URL immediately after the first deploy. Open it, sign up a teacher
account, and follow the [Supabase setup](#setting-up-supabase) steps above
(enable OAuth providers, run the seed script) against your production
project.

### 7. Using a custom domain later

1. Add your domain to Cloudflare (or it's already there if Cloudflare is
   your DNS provider).
2. In your Worker → **Settings → Domains & Routes → Add → Custom Domain**,
   enter e.g. `app.yourschool.com`. Cloudflare provisions the DNS record
   and TLS certificate automatically.
3. Update `NEXT_PUBLIC_SITE_URL` (build variable) and the Supabase Auth
   **Site URL** / **Redirect URLs** (Authentication → URL Configuration)
   to the new domain, then redeploy.

### Staying within the Workers Free plan

- The Free plan includes 100,000 requests/day and a 3MB compressed script
  size limit per Worker — this app avoids large server-only dependencies
  (no headless browsers, no heavy PDF/image libraries in the request path)
  to stay well under that.
- KV on the Free plan includes 100,000 reads/day and 1,000 writes/day,
  which comfortably covers the Next.js cache for a single classroom-scale
  deployment; heavy ISR usage across many pages is the main way to
  approach that limit.
- Supabase's free tier (500MB database, 1GB file storage, 50,000 monthly
  active users) is separate from Cloudflare's limits and is the more
  likely bottleneck at real school-district scale — upgrade that
  independently if needed.

### Known limitations / things to harden before a real rollout

- The coin-balance and reward-history writes in
  `src/app/api/attempts/route.ts` use `SECURITY DEFINER` Postgres
  functions for atomicity (see `0003_functions.sql`), but the surrounding
  application logic is still a straightforward read-then-write — adequate
  for classroom-scale concurrent traffic, but a single wrapping Postgres
  function (called once via `.rpc()`) would be worth doing before
  high-concurrency production use.
- Publicly-shared questions are readable via RLS by design (so students
  can browse the Public Practice Library once that UI is built), which
  means their `data` column (containing correct answers) is technically
  queryable directly against Supabase by a sufficiently determined student
  bypassing the app UI. The activity player already strips answers out of
  what's sent to the browser (`src/lib/engines/sanitize.ts`), which stops
  casual inspection of network responses, but it does not stop a direct
  Supabase query. For tests/exams where this matters, don't mark those
  questions `is_public`, or add a Postgres view that excludes the answer
  key for the `public_students` read path before relying on this for
  graded, high-stakes assessments.
- CSV import currently covers Multiple Choice, Fill in the Blank, and
  True/False (the templates specified in the Phase 1 spec). Templates for
  Matching / Word Order / Short Answer are designed but not wired to a
  parser yet — extend `src/lib/csv/templates.ts` and `parse.ts` following
  the same pattern.
- `next.config.ts` sets `images: { unoptimized: true }` because Cloudflare
  Workers can't run Next's built-in image optimizer. If image-heavy
  content (avatar assets, listening-question thumbnails) becomes
  significant, swap in a Cloudflare Images loader instead of serving
  unoptimized images.

## Project structure

```
src/
  app/                    Routes (App Router)
    (auth) login/signup/join
    dashboard/student, dashboard/teacher
    practice/[activityId]  Activity player
    activities/import      CSV import
    classes/new
    api/attempts           Grading + coin-award route handler
  components/              Client components (ActivityPlayer, charts)
  lib/
    coins.ts               Coin tier-reward logic (pure, unit-testable)
    engines/                Grading engines + Zod schemas + answer sanitizer
    csv/                    CSV templates + parser/validator
    supabase/               Browser / server / admin Supabase clients
  middleware.ts             Session refresh + role-based route guarding
  types/database.ts         Hand-written DB types (regenerate after schema changes)
supabase/
  migrations/                Schema, RLS policies, helper functions
  seed/                      Word Formation Practice + demo curriculum tree
```
