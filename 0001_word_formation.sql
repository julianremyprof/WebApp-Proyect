-- Seeds the "Word Formation Practice" fill-in-the-blank activity described
-- in the product spec, plus a minimal Book -> Unit -> Lesson -> Competence
-- -> Topic tree for it to live in.
--
-- HOW TO RUN:
--   1. Sign up one teacher account through the app (or Supabase Auth) so a
--      row exists in `profiles` with role = 'teacher'.
--   2. In the Supabase SQL editor, replace OWNER_EMAIL below with that
--      teacher's email, then run this whole file.
--
-- This seed is safe to re-run: it upserts by natural key instead of
-- inserting duplicates.

do $$
declare
  v_owner_id uuid;
  v_book_id uuid;
  v_unit_id uuid;
  v_lesson_id uuid;
  v_competence_id uuid;
  v_topic_id uuid;
  v_activity_id uuid;
  q record;
begin
  select p.id into v_owner_id
  from profiles p
  join auth.users u on u.id = p.id
  where u.email = 'OWNER_EMAIL' and p.role = 'teacher';

  if v_owner_id is null then
    raise exception 'No teacher found for OWNER_EMAIL - update the email in this script and re-run.';
  end if;

  insert into books (owner_id, title, is_public)
  values (v_owner_id, 'English Book 1', true)
  returning id into v_book_id;

  insert into units (book_id, title, sort_order)
  values (v_book_id, 'Unit 1: Personality', 1)
  returning id into v_unit_id;

  insert into lessons (unit_id, title, sort_order)
  values (v_unit_id, 'Lesson 1: Personal Characteristics', 1)
  returning id into v_lesson_id;

  insert into competences (lesson_id, type, sort_order)
  values (v_lesson_id, 'grammar', 1)
  returning id into v_competence_id;

  insert into topics (competence_id, title)
  values (v_competence_id, 'Word Formation')
  returning id into v_topic_id;

  insert into activities (
    owner_id, kind, title, topic_id, status, visibility,
    max_attempts, randomize_question_order, show_correct_answers,
    passing_score_percent, coin_rewards_enabled
  ) values (
    v_owner_id, 'practice', 'Word Formation Practice', v_topic_id, 'published', 'public_students',
    null, false, true, 60, true
  ) returning id into v_activity_id;

  -- 40 fill-in-the-blank questions. Grading is case-insensitive with
  -- whitespace normalization (see src/lib/engines/gradeFillBlank.ts),
  -- matching "Ignore capitalization / extra spaces" in the spec.
  for q in
    select * from (values
      (1, 'How long is the __________ from Rome to Paris?', 'FLY', array['flight']),
      (2, 'I have a very good __________ with both my parents.', 'RELATION', array['relationship']),
      (3, 'Pulling my front tooth didn''t hurt. It was completely __________.', 'PAIN', array['painless']),
      (4, 'I can tell from your __________ that you''re not really happy.', 'EXPRESS', array['expression']),
      (5, 'We offer free __________ for purchases over €100.', 'DELIVER', array['delivery']),
      (6, 'James hasn''t had a lot of __________ lately, so I hope he''ll do well with his new company.', 'SUCCEED', array['success']),
      (7, 'It is __________ colder today than it was yesterday.', 'CERTAIN', array['certainly']),
      (8, 'What __________ is he? Spanish or Portuguese?', 'NATION', array['nationality']),
      (9, 'You have the __________. You can either go by bus or walk.', 'CHOOSE', array['choice']),
      (10, 'My best friend has a great __________.', 'PERSON', array['personality']),
      (11, 'You need a lot of __________ to write a good story.', 'IMAGINE', array['imagination']),
      (12, 'The lesson was __________. I almost fell asleep.', 'BORE', array['boring']),
      (13, 'Don''t be so __________. This is the second vase you have broken this month.', 'CARE', array['careless']),
      (14, 'It''s simply __________. I have won the lottery.', 'BELIEVE', array['unbelievable']),
      (15, 'I have to hold a __________ at my brother''s wedding.', 'SPEAK', array['speech']),
      (16, 'There''s a lot of __________ about that on the internet.', 'INFORM', array['information']),
      (17, 'The children were very __________ when the teacher came in.', 'NOISE', array['noisy']),
      (18, 'The film was a bit __________. I didn''t really understand what happened.', 'CONFUSE', array['confusing']),
      (19, 'He has to wear these gloves for __________ reasons.', 'SAFE', array['safety']),
      (20, 'Sally was __________ for two years before she found a new job.', 'EMPLOY', array['unemployed', 'employed']),
      (21, 'In India, there are a lot of __________ in the streets.', 'BEG', array['beggars']),
      (22, 'When I gave up smoking I started putting on more __________.', 'WEIGH', array['weight']),
      (23, 'I had no __________ in finding the right street.', 'DIFFICULT', array['difficulty']),
      (24, 'He talked about __________ and peace in our world.', 'FREE', array['freedom']),
      (25, '__________, I was invited to watch the new film.', 'LUCKY', array['luckily']),
      (26, 'The __________ of our rainforests is a serious problem.', 'DESTROY', array['destruction']),
      (27, 'Animals in a zoo don''t live in their __________ environment.', 'NATURE', array['natural']),
      (28, '__________ does not have anything to do with how much money you have.', 'HAPPY', array['happiness']),
      (29, 'Thank you for being so __________ yesterday.', 'HELP', array['helpful']),
      (30, 'He has been a long-__________ runner for a few years now.', 'DISTANT', array['distance']),
      (31, 'Don''t you think it''s too __________ for you to go sailing in such weather?', 'DANGER', array['dangerous']),
      (32, 'This is my last __________. Don''t walk across the lawn!', 'WARN', array['warning']),
      (33, 'He gave me some good __________ on where to go shopping.', 'ADVISE', array['advice']),
      (34, 'If you want to complain about the product, please go to the __________.', 'MANAGE', array['management', 'manager']),
      (35, 'The new flat is not __________. It''s too expensive.', 'AFFORD', array['affordable']),
      (36, 'John is six years old. He''s very __________ and full of life.', 'ACT', array['active']),
      (37, 'My mother spent her __________ in France.', 'CHILD', array['childhood']),
      (38, 'I have made a few __________ to your article.', 'CORRECT', array['corrections']),
      (39, 'Every child should get a good __________.', 'EDUCATE', array['education']),
      (40, 'Listen carefully to the __________ before you go out!', 'INSTRUCT', array['instructions'])
    ) as t(sort_order, sentence, base_word, accepted)
  loop
    insert into questions (owner_id, topic_id, type, prompt, data, explanation, is_public)
    values (
      v_owner_id, v_topic_id, 'fill_in_blank', q.sentence,
      jsonb_build_object(
        'base_word', q.base_word,
        'blanks', jsonb_build_array(
          jsonb_build_object('accepted', to_jsonb(q.accepted), 'case_sensitive', false)
        )
      ),
      null, true
    );
  end loop;
end $$;

-- questions.id is a random UUID (not a sequence), so link each question to
-- the activity in a separate statement, ordered by insertion time to
-- preserve question order 1-40:
with ordered_questions as (
  select id, row_number() over (order by created_at) as rn
  from questions
  where topic_id = (select id from topics where title = 'Word Formation' limit 1)
    and type = 'fill_in_blank'
),
target_activity as (
  select id from activities where title = 'Word Formation Practice' limit 1
)
insert into activity_questions (activity_id, question_id, sort_order)
select target_activity.id, ordered_questions.id, ordered_questions.rn
from ordered_questions, target_activity
on conflict do nothing;
