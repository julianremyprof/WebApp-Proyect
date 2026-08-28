-- Atomic helpers called via supabase.rpc() from the trusted admin client
-- in src/app/api/attempts/route.ts. Using SECURITY DEFINER functions for
-- the read-modify-write steps (rather than separate select+update calls
-- from the app) avoids a lost-update race if a student somehow submits
-- two attempts for the same practice concurrently.

create or replace function increment_coin_balance(p_student_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update student_profiles
  set coin_balance = coin_balance + p_amount
  where profile_id = p_student_id;
end;
$$;

create or replace function increment_tier3_times_earned(p_student_id uuid, p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update practice_reward_history
  set times_earned = times_earned + 1
  where student_id = p_student_id and activity_id = p_activity_id and tier = 3;
end;
$$;

-- Only the service role should ever call these (the app never exposes
-- them to the anon/authenticated roles directly).
revoke execute on function increment_coin_balance(uuid, integer) from public, anon, authenticated;
revoke execute on function increment_tier3_times_earned(uuid, uuid) from public, anon, authenticated;
