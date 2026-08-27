-- ProLearnin6 core schema
-- Run via Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- Designed for Postgres + Supabase Auth (auth.users is the source of truth
-- for login identity; `profiles` extends it with app-level data).

create extension if not exists "pgcrypto";

-- =========================================================================
-- 1. IDENTITY / ROLES
-- =========================================================================

create type user_role as enum ('student', 'teacher', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'student',
  full_name text not null,
  avatar_url text, -- rendered avatar thumbnail (generated from avatar_inventory)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teacher-only profile extension
create table teacher_profiles (
  profile_id uuid primary key references profiles (id) on delete cascade,
  school_name text,
  bio text
);

-- Student-only profile extension
create table student_profiles (
  profile_id uuid primary key references profiles (id) on delete cascade,
  grade_level text,
  coin_balance integer not null default 0 check (coin_balance >= 0)
);

-- =========================================================================
-- 2. CLASSES
-- =========================================================================

create table classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  class_code text not null unique,
  code_active boolean not null default true,
  allow_self_join boolean not null default true,
  created_at timestamptz not null default now()
);

create table class_memberships (
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index class_memberships_student_idx on class_memberships (student_id);

-- =========================================================================
-- 3. CURRICULUM HIERARCHY: Book -> Unit -> Lesson -> Competence -> Topic
-- =========================================================================

create type competence_type as enum
  ('grammar', 'reading', 'listening', 'speaking', 'writing', 'vocabulary');

create table books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0
);

create table competences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  type competence_type not null,
  sort_order integer not null default 0
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  competence_id uuid not null references competences (id) on delete cascade,
  title text not null
);

-- =========================================================================
-- 4. QUESTION BANK
-- =========================================================================

create type question_type as enum (
  'multiple_choice', 'fill_in_blank', 'true_false', 'matching',
  'drag_and_drop', 'word_order', 'short_answer', 'essay',
  'listening', 'image_based', 'speaking'
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  topic_id uuid references topics (id) on delete set null,
  type question_type not null,
  prompt text not null,
  -- Type-specific payload. Kept as JSONB rather than one table per type so
  -- new question types (Phase 2/3) don't require schema migrations.
  -- Shape by type (informal contract, validated in application code with
  -- Zod - see src/lib/engines/schemas.ts):
  --   multiple_choice: { options: [{id, text}], correct_option_ids: string[] }
  --   fill_in_blank:    { blanks: [{ accepted: string[], case_sensitive: bool }] }
  --   true_false:       { correct_answer: boolean }
  --   matching:         { pairs: [{ left, right }] }
  --   word_order:       { correct_sentence: string, words: string[] }
  --   short_answer:     { accepted: string[], case_sensitive: bool }
  --   essay/speaking:   { rubric?: string, grading_mode: 'manual'|'ai_assisted'|'ai_suggested' }
  data jsonb not null default '{}'::jsonb,
  explanation text,
  media_url text, -- audio/image storage path (Supabase Storage) for
                   -- listening/image-based/speaking questions
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questions_owner_idx on questions (owner_id);
create index questions_topic_idx on questions (topic_id);
create index questions_type_idx on questions (type);

-- Named, reusable groupings of questions (a teacher's personal folders,
-- independent of the curriculum tree above).
create table question_bank_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null
);

create table question_bank_collection_items (
  collection_id uuid not null references question_bank_collections (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  primary key (collection_id, question_id)
);

-- =========================================================================
-- 5. ACTIVITIES (Practices & Tests)
-- =========================================================================

create type activity_kind as enum ('practice', 'test');

create type activity_status as enum (
  'draft', 'published', 'private', 'scheduled', 'closed'
);

create type grade_visibility as enum ('hidden', 'released');

create type activity_visibility as enum (
  'private', 'assigned_only', 'shared_teachers', 'public_teachers', 'public_students'
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  kind activity_kind not null,
  title text not null,
  topic_id uuid references topics (id) on delete set null,
  status activity_status not null default 'draft',
  visibility activity_visibility not null default 'private',
  grade_visibility grade_visibility not null default 'released', -- practices: always released; tests: teacher-controlled

  -- shared settings (practice + test)
  max_attempts integer, -- null = unlimited
  time_limit_seconds integer, -- null = no timer
  randomize_question_order boolean not null default false,
  randomize_answer_order boolean not null default false,
  show_correct_answers boolean not null default true, -- practices: instant feedback; tests: usually false
  passing_score_percent integer default 60,
  opens_at timestamptz,
  closes_at timestamptz,

  -- test-only settings
  password text, -- null = no password required

  coin_rewards_enabled boolean not null default true, -- practices only, per spec section 6

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint test_no_coins check (kind = 'practice' or coin_rewards_enabled = false)
);

create index activities_owner_idx on activities (owner_id);
create index activities_status_idx on activities (status);

-- Ordered set of questions belonging to an activity, with per-activity
-- overrides (e.g. a question bank item reused with a tweaked point value).
create table activity_questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  question_id uuid not null references questions (id) on delete restrict,
  sort_order integer not null default 0,
  points numeric not null default 1
);

create index activity_questions_activity_idx on activity_questions (activity_id);

-- Assignment: an activity handed to all students / a class / a group / one student
create type assignee_kind as enum ('all_students', 'class', 'group', 'student');

create table assignments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  assignee_kind assignee_kind not null,
  class_id uuid references classes (id) on delete cascade,
  student_id uuid references profiles (id) on delete cascade,
  group_id uuid, -- reserved for future student-group table
  due_at timestamptz,
  created_at timestamptz not null default now(),

  constraint assignment_target_matches_kind check (
    (assignee_kind = 'class' and class_id is not null and student_id is null) or
    (assignee_kind = 'student' and student_id is not null and class_id is null) or
    (assignee_kind in ('all_students', 'group'))
  )
);

-- =========================================================================
-- 6. ATTEMPTS (history is append-only - never overwritten on retry)
-- =========================================================================

create table attempts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  attempt_number integer not null, -- 1, 2, 3... per student per activity
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score_percent numeric, -- null until graded (essay/speaking may be pending)
  raw_score numeric,
  max_score numeric,
  passed boolean,
  grade_released boolean not null default true, -- mirrors activity.grade_visibility at submit time
  time_spent_seconds integer,

  unique (activity_id, student_id, attempt_number)
);

create index attempts_student_idx on attempts (student_id);
create index attempts_activity_idx on attempts (activity_id);

create table attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts (id) on delete cascade,
  question_id uuid not null references questions (id) on delete restrict,
  response jsonb not null, -- shape mirrors the question type's expected answer
  is_correct boolean, -- null for ungraded free-response (essay/speaking) until reviewed
  points_awarded numeric,
  teacher_feedback text,
  ai_suggested_score numeric,
  ai_feedback text
);

create index attempt_answers_attempt_idx on attempt_answers (attempt_id);

-- =========================================================================
-- 7. COIN SYSTEM (see src/lib/coins.ts for the tier logic this backs)
-- =========================================================================

create table coin_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  amount integer not null, -- positive = earn, negative = spend
  reason text not null, -- 'practice_reward' | 'shop_purchase' | 'badge_award' | 'admin_adjustment'
  related_attempt_id uuid references attempts (id) on delete set null,
  related_item_id uuid, -- avatar_items.id when reason = 'shop_purchase'
  related_badge_id uuid, -- badges.id when reason = 'badge_award'
  created_at timestamptz not null default now()
);

create index coin_transactions_student_idx on coin_transactions (student_id);

-- One row per (student, practice, tier) the student has ever earned.
-- This is the authoritative "already rewarded" record described in the
-- spec - tier eligibility must never be re-derived from score history
-- alone, because Tier 3 keeps paying out on every future 91%+ attempt.
create table practice_reward_history (
  student_id uuid not null references profiles (id) on delete cascade,
  activity_id uuid not null references activities (id) on delete cascade,
  tier smallint not null check (tier in (1, 2, 3)),
  first_earned_at timestamptz not null default now(),
  times_earned integer not null default 1, -- only increments for tier 3 repeats
  primary key (student_id, activity_id, tier)
);

-- =========================================================================
-- 8. AVATAR SYSTEM
-- =========================================================================

create type avatar_category as enum (
  'skin_tone', 'hair', 'hair_style', 'eyes', 'facial_features',
  'clothing', 'accessories', 'hats', 'glasses', 'pets', 'backgrounds', 'decorative'
);

create table avatar_items (
  id uuid primary key default gen_random_uuid(),
  category avatar_category not null,
  name text not null,
  asset_url text not null,
  price_coins integer not null default 0, -- 0 = free starter item
  unlocked_by_badge_id uuid, -- references badges(id), added after badges table below
  is_starter boolean not null default false,
  created_at timestamptz not null default now()
);

create table avatar_inventory (
  student_id uuid not null references profiles (id) on delete cascade,
  item_id uuid not null references avatar_items (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (student_id, item_id)
);

create index avatar_inventory_student_idx on avatar_inventory (student_id);

-- =========================================================================
-- 9. BADGES
-- =========================================================================

create table badges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade, -- teacher who created it
  name text not null,
  description text,
  icon_url text,
  coin_value integer not null default 0,
  award_mode text not null default 'manual' check (award_mode in ('manual', 'automatic')),
  criteria jsonb, -- e.g. { "type": "perfect_score", "activity_id": "..." } for automatic badges
  created_at timestamptz not null default now()
);

alter table avatar_items
  add constraint avatar_items_badge_fk
  foreign key (unlocked_by_badge_id) references badges (id) on delete set null;

create table badge_awards (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references badges (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references profiles (id), -- null when awarded automatically

  unique (badge_id, student_id)
);

-- =========================================================================
-- 10. STUDENT SUGGESTIONS
-- =========================================================================

create type suggestion_status as enum ('new', 'under_review', 'planned', 'completed');

create table student_suggestions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  message text not null,
  status suggestion_status not null default 'new',
  created_at timestamptz not null default now()
);

-- =========================================================================
-- 11. TEACHER CONTENT SHARING
-- =========================================================================

create table content_shares (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities (id) on delete cascade,
  question_id uuid references questions (id) on delete cascade,
  shared_by uuid not null references profiles (id) on delete cascade,
  shared_with uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint content_share_target check (
    (activity_id is not null and question_id is null) or
    (activity_id is null and question_id is not null)
  )
);

-- =========================================================================
-- 12. AI GENERATION HISTORY (Phase 3 - table exists now so Phase 1/2 code
--     and RLS can be written against a stable schema)
-- =========================================================================

create table ai_generation_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  input jsonb not null, -- topic, competence, level, count, type, instructions
  provider text, -- null until AI_PROVIDER is configured
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'not_configured')),
  generated_questions jsonb, -- draft questions, reviewed/edited before becoming real `questions` rows
  created_at timestamptz not null default now()
);

-- =========================================================================
-- updated_at triggers
-- =========================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger questions_set_updated_at before update on questions
  for each row execute function set_updated_at();
create trigger activities_set_updated_at before update on activities
  for each row execute function set_updated_at();
