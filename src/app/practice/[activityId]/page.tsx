import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeQuestionForStudent } from "@/lib/engines/sanitize";
import ActivityPlayer from "@/components/ActivityPlayer";

// "word-formation" is a friendly alias for the seeded demo activity so the
// dashboard link doesn't need to know its generated UUID; any other
// segment is treated as a real activity id.
async function resolveActivityId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, param: string) {
  if (param !== "word-formation") return param;
  const { data } = await supabase
    .from("activities")
    .select("id")
    .eq("title", "Word Formation Practice")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export default async function PracticePage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId: activityParam } = await params;
  const supabase = await createServerSupabaseClient();

  const activityId = await resolveActivityId(supabase, activityParam);
  if (!activityId) notFound();

  const { data: activity } = await supabase
    .from("activities")
    .select(
      "id, title, kind, max_attempts, time_limit_seconds, randomize_question_order, passing_score_percent, coin_rewards_enabled",
    )
    .eq("id", activityId)
    .single();

  if (!activity) notFound();

  const { data: activityQuestions } = await supabase
    .from("activity_questions")
    .select("sort_order, points, questions(id, type, prompt, media_url, data)")
    .eq("activity_id", activity.id)
    .order("sort_order", { ascending: true });

  const questions = (activityQuestions ?? [])
    // @ts-expect-error joined relation typed loosely for Phase 1
    .filter((aq) => aq.questions)
    // @ts-expect-error joined relation typed loosely for Phase 1
    .map((aq) => sanitizeQuestionForStudent(aq.questions));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <ActivityPlayer
        activityId={activity.id}
        title={activity.title}
        kind={activity.kind}
        questions={questions}
        randomize={activity.randomize_question_order}
        coinRewardsEnabled={activity.coin_rewards_enabled}
      />
    </main>
  );
}
