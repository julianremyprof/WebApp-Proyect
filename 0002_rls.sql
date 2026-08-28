-- Row Level Security for ProLearnin6.
-- Principle (spec section 28): never trust client-side role checks alone -
-- every table a student or teacher can reach directly is locked down here.
-- Server code using the SERVICE ROLE key (e.g. admin moderation actions)
-- bypasses RLS by design and must enforce admin-only checks itself.

-- ---- helper functions -----------------------------------------------

create or replace function auth_role()
returns user_role language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_teacher_of_class(target_class_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from classes
    where id = target_class_id and teacher_id = auth.uid()
  )
$$;

create or replace function is_student_in_class(target_class_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from class_memberships
    where class_id = target_class_id and student_id = auth.uid()
  )
$$;

-- Enable RLS everywhere it matters.
alter table profiles enable row level security;
alter table teacher_profiles enable row level security;
alter table student_profiles enable row level security;
alter table classes enable row level security;
alter table class_memberships enable row level security;
alter table books enable row level security;
alter table units enable row level security;
alter table lessons enable row level security;
alter table competences enable row level security;
alter table topics enable row level security;
alter table questions enable row level security;
alter table question_bank_collections enable row level security;
alter table question_bank_collection_items enable row level security;
alter table activities enable row level security;
alter table activity_questions enable row level security;
alter table assignments enable row level security;
alter table attempts enable row level security;
alter table attempt_answers enable row level security;
alter table coin_transactions enable row level security;
alter table practice_reward_history enable row level security;
alter table avatar_items enable row level security;
alter table avatar_inventory enable row level security;
alter table badges enable row level security;
alter table badge_awards enable row level security;
alter table student_suggestions enable row level security;
alter table content_shares enable row level security;
alter table ai_generation_requests enable row level security;

-- ---- profiles ----------------------------------------------------------

create policy "profiles: read own" on profiles
  for select using (id = auth.uid());

create policy "profiles: teachers read their students" on profiles
  for select using (
    auth_role() = 'teacher' and exists (
      select 1 from class_memberships cm
      join classes c on c.id = cm.class_id
      where cm.student_id = profiles.id and c.teacher_id = auth.uid()
    )
  );

create policy "profiles: admins read all" on profiles
  for select using (auth_role() = 'admin');

create policy "profiles: update own" on profiles
  for update using (id = auth.uid());

create policy "profiles: insert own on signup" on profiles
  for insert with check (id = auth.uid());

-- teacher_profiles / student_profiles follow the parent profile row
create policy "teacher_profiles: owner rw" on teacher_profiles
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "student_profiles: owner read" on student_profiles
  for select using (profile_id = auth.uid());
create policy "student_profiles: owner insert" on student_profiles
  for insert with check (profile_id = auth.uid());
create policy "student_profiles: teachers read their students" on student_profiles
  for select using (
    exists (
      select 1 from class_memberships cm
      join classes c on c.id = cm.class_id
      where cm.student_id = student_profiles.profile_id and c.teacher_id = auth.uid()
    )
  );
-- coin_balance mutations only ever happen via the server-side attempt/shop
-- routes (service role), never a direct client update - no client UPDATE
-- policy is granted on student_profiles.

-- ---- classes -------------------------------------------------------------

create policy "classes: teacher manages own" on classes
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "classes: students read joined classes" on classes
  for select using (is_student_in_class(id));

create policy "classes: students read by active code (to join)" on classes
  for select using (code_active = true and allow_self_join = true);

create policy "class_memberships: student manages own membership" on class_memberships
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy "class_memberships: teacher reads own class rosters" on class_memberships
  for select using (is_teacher_of_class(class_id));

create policy "class_memberships: teacher removes students" on class_memberships
  for delete using (is_teacher_of_class(class_id));

-- ---- curriculum tree (books/units/lessons/competences/topics) -----------
-- Visible if: you own the book, OR the book is public.

create policy "books: owner rw" on books
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "books: public read" on books
  for select using (is_public = true);

create policy "units: via book" on units
  for select using (
    exists (select 1 from books b where b.id = units.book_id
      and (b.owner_id = auth.uid() or b.is_public))
  );
create policy "units: owner write" on units
  for insert with check (exists (select 1 from books b where b.id = book_id and b.owner_id = auth.uid()));
create policy "units: owner update" on units
  for update using (exists (select 1 from books b where b.id = book_id and b.owner_id = auth.uid()));
create policy "units: owner delete" on units
  for delete using (exists (select 1 from books b where b.id = book_id and b.owner_id = auth.uid()));

create policy "lessons: via unit->book" on lessons
  for select using (
    exists (
      select 1 from units u join books b on b.id = u.book_id
      where u.id = lessons.unit_id and (b.owner_id = auth.uid() or b.is_public)
    )
  );
create policy "lessons: owner write" on lessons
  for insert with check (
    exists (select 1 from units u join books b on b.id = u.book_id
      where u.id = unit_id and b.owner_id = auth.uid())
  );
create policy "lessons: owner update" on lessons
  for update using (
    exists (select 1 from units u join books b on b.id = u.book_id
      where u.id = unit_id and b.owner_id = auth.uid())
  );
create policy "lessons: owner delete" on lessons
  for delete using (
    exists (select 1 from units u join books b on b.id = u.book_id
      where u.id = unit_id and b.owner_id = auth.uid())
  );

create policy "competences: via lesson chain" on competences
  for select using (
    exists (
      select 1 from lessons l join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where l.id = competences.lesson_id and (b.owner_id = auth.uid() or b.is_public)
    )
  );
create policy "competences: owner write" on competences
  for insert with check (
    exists (select 1 from lessons l join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where l.id = lesson_id and b.owner_id = auth.uid())
  );
create policy "competences: owner update" on competences
  for update using (
    exists (select 1 from lessons l join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where l.id = lesson_id and b.owner_id = auth.uid())
  );
create policy "competences: owner delete" on competences
  for delete using (
    exists (select 1 from lessons l join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where l.id = lesson_id and b.owner_id = auth.uid())
  );

create policy "topics: via competence chain" on topics
  for select using (
    exists (
      select 1 from competences c
      join lessons l on l.id = c.lesson_id join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where c.id = topics.competence_id and (b.owner_id = auth.uid() or b.is_public)
    )
  );
create policy "topics: owner write" on topics
  for insert with check (
    exists (select 1 from competences c
      join lessons l on l.id = c.lesson_id join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where c.id = competence_id and b.owner_id = auth.uid())
  );
create policy "topics: owner update" on topics
  for update using (
    exists (select 1 from competences c
      join lessons l on l.id = c.lesson_id join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where c.id = competence_id and b.owner_id = auth.uid())
  );
create policy "topics: owner delete" on topics
  for delete using (
    exists (select 1 from competences c
      join lessons l on l.id = c.lesson_id join units u on u.id = l.unit_id join books b on b.id = u.book_id
      where c.id = competence_id and b.owner_id = auth.uid())
  );

-- ---- questions / question bank -------------------------------------------

create policy "questions: owner rw" on questions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "questions: public read" on questions
  for select using (is_public = true);
create policy "questions: shared read" on questions
  for select using (
    exists (select 1 from content_shares cs where cs.question_id = questions.id and cs.shared_with = auth.uid())
  );
-- Students only see a question's content bundled read-only inside an
-- attempt payload delivered by server code (never a direct SELECT grant),
-- so correct answers for in-progress tests can't be read from the client.

create policy "collections: owner rw" on question_bank_collections
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "collection_items: owner rw" on question_bank_collection_items
  for all using (
    exists (select 1 from question_bank_collections c where c.id = collection_id and c.owner_id = auth.uid())
  );

-- ---- activities ------------------------------------------------------------

create policy "activities: owner rw" on activities
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "activities: public practices readable by students" on activities
  for select using (
    status = 'published' and visibility = 'public_students' and auth_role() = 'student'
  );

create policy "activities: shared with teacher" on activities
  for select using (
    exists (select 1 from content_shares cs where cs.activity_id = activities.id and cs.shared_with = auth.uid())
  );

create policy "activities: assigned students can read" on activities
  for select using (
    exists (
      select 1 from assignments a
      where a.activity_id = activities.id and (
        a.assignee_kind = 'all_students'
        or (a.assignee_kind = 'student' and a.student_id = auth.uid())
        or (a.assignee_kind = 'class' and is_student_in_class(a.class_id))
      )
    )
  );

create policy "activity_questions: via activity access" on activity_questions
  for select using (
    exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid())
    or exists (
      select 1 from assignments a where a.activity_id = activity_questions.activity_id and (
        a.assignee_kind = 'all_students'
        or (a.assignee_kind = 'student' and a.student_id = auth.uid())
        or (a.assignee_kind = 'class' and is_student_in_class(a.class_id))
      )
    )
  );
create policy "activity_questions: owner write" on activity_questions
  for insert with check (exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid()));
create policy "activity_questions: owner update" on activity_questions
  for update using (exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid()));
create policy "activity_questions: owner delete" on activity_questions
  for delete using (exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid()));

create policy "assignments: teacher manages own activity's assignments" on assignments
  for all using (exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid()))
  with check (exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid()));
create policy "assignments: students read their own" on assignments
  for select using (
    assignee_kind = 'all_students'
    or (assignee_kind = 'student' and student_id = auth.uid())
    or (assignee_kind = 'class' and is_student_in_class(class_id))
  );

-- ---- attempts ---------------------------------------------------------------
-- Students see and create only their own attempts. Grading writes (score,
-- is_correct, points_awarded) happen through the server route using the
-- service role, so no client UPDATE policy is granted on attempts/answers
-- beyond the student's own insert of their responses during a session.

create policy "attempts: student owns" on attempts
  for select using (student_id = auth.uid());
create policy "attempts: student inserts own" on attempts
  for insert with check (student_id = auth.uid());

create policy "attempts: teacher reads results for own activities" on attempts
  for select using (exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid()));

create policy "attempt_answers: student reads own" on attempt_answers
  for select using (exists (select 1 from attempts at2 where at2.id = attempt_id and at2.student_id = auth.uid()));
create policy "attempt_answers: student inserts own" on attempt_answers
  for insert with check (exists (select 1 from attempts at2 where at2.id = attempt_id and at2.student_id = auth.uid()));
create policy "attempt_answers: teacher reads for own activities" on attempt_answers
  for select using (
    exists (
      select 1 from attempts at2 join activities act on act.id = at2.activity_id
      where at2.id = attempt_id and act.owner_id = auth.uid()
    )
  );
create policy "attempt_answers: teacher grades free-response" on attempt_answers
  for update using (
    exists (
      select 1 from attempts at2 join activities act on act.id = at2.activity_id
      where at2.id = attempt_id and act.owner_id = auth.uid()
    )
  );

-- ---- coins / rewards --------------------------------------------------------

create policy "coin_transactions: student reads own" on coin_transactions
  for select using (student_id = auth.uid());
-- No client insert policy: all coin transactions are written by the
-- server-side attempt-grading and shop-purchase routes (service role),
-- which is what makes "prevent negative balances" enforceable server-side.

create policy "practice_reward_history: student reads own" on practice_reward_history
  for select using (student_id = auth.uid());
create policy "practice_reward_history: teacher reads for own activities" on practice_reward_history
  for select using (exists (select 1 from activities act where act.id = activity_id and act.owner_id = auth.uid()));

-- ---- avatar system -----------------------------------------------------------

create policy "avatar_items: public read" on avatar_items
  for select using (true);

create policy "avatar_inventory: student owns" on avatar_inventory
  for select using (student_id = auth.uid());
create policy "avatar_inventory: student equips owned items" on avatar_inventory
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
-- Item purchases (insert) go through the server shop route so coin
-- deduction and inventory insert happen atomically.

-- ---- badges --------------------------------------------------------------------

create policy "badges: owner rw" on badges
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "badges: readable by students in owner's classes" on badges
  for select using (
    exists (
      select 1 from classes c
      join class_memberships cm on cm.class_id = c.id
      where c.teacher_id = badges.owner_id and cm.student_id = auth.uid()
    )
  );

create policy "badge_awards: student reads own" on badge_awards
  for select using (student_id = auth.uid());
create policy "badge_awards: teacher reads/awards for own badges" on badge_awards
  for all using (exists (select 1 from badges b where b.id = badge_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from badges b where b.id = badge_id and b.owner_id = auth.uid()));

-- ---- suggestions ------------------------------------------------------------------

create policy "suggestions: student manages own" on student_suggestions
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "suggestions: teacher reads all" on student_suggestions
  for select using (auth_role() = 'teacher');
create policy "suggestions: teacher updates status" on student_suggestions
  for update using (auth_role() = 'teacher');

-- ---- content sharing -----------------------------------------------------------------

create policy "content_shares: sharer manages" on content_shares
  for all using (shared_by = auth.uid()) with check (shared_by = auth.uid());
create policy "content_shares: recipient reads" on content_shares
  for select using (shared_with = auth.uid());

-- ---- AI generation requests --------------------------------------------------------------

create policy "ai_requests: teacher owns" on ai_generation_requests
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- ---- Super Admin override ---------------------------------------------------------------
-- Admins get broad read access for moderation; destructive actions
-- (removing public content, banning accounts) are performed through
-- server routes using the service role and an explicit admin check, not
-- direct client writes, per spec section 2 ("do not expose Super Admin
-- functionality... enforce at the database level").

create policy "admin: read all activities" on activities
  for select using (auth_role() = 'admin');
create policy "admin: read all questions" on questions
  for select using (auth_role() = 'admin');
create policy "admin: read all classes" on classes
  for select using (auth_role() = 'admin');
