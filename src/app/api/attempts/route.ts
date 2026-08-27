import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { gradeFillInBlank, gradeMatching, gradeMultipleChoice, gradeTrueFalse, gradeWordOrder } from "@/lib/engines/grading";
import { computeCoinReward } from "@/lib/coins";
import type { FillInBlankData, MatchingData, MultipleChoiceData, TrueFalseData, WordOrderData } from "@/lib/engines/schemas";

export const runtime = "edge"; // Cloudflare Workers compatible

const bodySchema = z.object({
  activityId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      response: z.unknown(),
    }),
  ),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { activityId, answers } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // RLS scopes this to activities the student is actually allowed to see
  // (assigned, public practice, etc.) - if it comes back null, they don't
  // have access and we stop here rather than trusting the request body.
  const { data: activity } = await supabase
    .from("activities")
    .select(
      "id, kind, max_attempts, passing_score_percent, coin_rewards_enabled, closes_at, opens_at, grade_visibility",
    )
    .eq("id", activityId)
    .single();
  if (!activity) return NextResponse.json({ error: "Activity not found or not accessible." }, { status: 404 });

  const now = new Date();
  if (activity.opens_at && new Date(activity.opens_at) > now) {
    return NextResponse.json({ error: "This activity hasn't opened yet." }, { status: 403 });
  }
  if (activity.closes_at && new Date(activity.closes_at) < now) {
    return NextResponse.json({ error: "This activity is closed." }, { status: 403 });
  }

  const { count: priorAttempts } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activityId)
    .eq("student_id", user.id);

  const attemptNumber = (priorAttempts ?? 0) + 1;
  if (activity.max_attempts != null && attemptNumber > activity.max_attempts) {
    return NextResponse.json({ error: "No attempts remaining for this activity." }, { status: 403 });
  }

  const { data: activityQuestions } = await supabase
    .from("activity_questions")
    .select("points, questions(id, type, data)")
    .eq("activity_id", activityId);

  if (!activityQuestions?.length) {
    return NextResponse.json({ error: "This activity has no questions." }, { status: 422 });
  }

  let rawScore = 0;
  let maxScore = 0;
  const gradedAnswers: Array<{
    question_id: string;
    response: unknown;
    is_correct: boolean | null;
    points_awarded: number | null;
  }> = [];

  for (const aq of activityQuestions) {
    // @ts-expect-error joined relation typed loosely for Phase 1
    const question = aq.questions;
    if (!question) continue;
    const submitted = answers.find((a) => a.questionId === question.id);
    maxScore += aq.points;

    if (!submitted?.response) {
      gradedAnswers.push({ question_id: question.id, response: {}, is_correct: false, points_awarded: 0 });
      continue;
    }

    if (question.type === "fill_in_blank") {
      const { isCorrect, pointsAwarded } = gradeFillInBlank(
        question.data as FillInBlankData,
        submitted.response as { blank_values: string[] },
        aq.points,
      );
      rawScore += pointsAwarded;
      gradedAnswers.push({ question_id: question.id, response: submitted.response, is_correct: isCorrect, points_awarded: pointsAwarded });
    } else if (question.type === "multiple_choice") {
      const { isCorrect, pointsAwarded } = gradeMultipleChoice(
        question.data as MultipleChoiceData,
        submitted.response as { selected_option_ids: string[] },
        aq.points,
      );
      rawScore += pointsAwarded;
      gradedAnswers.push({ question_id: question.id, response: submitted.response, is_correct: isCorrect, points_awarded: pointsAwarded });
    } else if (question.type === "true_false") {
      const { isCorrect, pointsAwarded } = gradeTrueFalse(
        question.data as TrueFalseData,
        submitted.response as { answer: boolean },
        aq.points,
      );
      rawScore += pointsAwarded;
      gradedAnswers.push({ question_id: question.id, response: submitted.response, is_correct: isCorrect, points_awarded: pointsAwarded });
    } else if (question.type === "matching") {
      const { isCorrect, pointsAwarded } = gradeMatching(
        question.data as MatchingData,
        submitted.response as { matches: Record<string, string> },
        aq.points,
      );
      rawScore += pointsAwarded;
      gradedAnswers.push({ question_id: question.id, response: submitted.response, is_correct: isCorrect, points_awarded: pointsAwarded });
    } else if (question.type === "word_order") {
      const { isCorrect, pointsAwarded } = gradeWordOrder(
        question.data as WordOrderData,
        submitted.response as { ordered_words: string[] },
        aq.points,
      );
      rawScore += pointsAwarded;
      gradedAnswers.push({ question_id: question.id, response: submitted.response, is_correct: isCorrect, points_awarded: pointsAwarded });
    } else {
      // Essay / speaking / other free-response types: stored ungraded,
      // awaiting manual or AI-assisted teacher review (Phase 2/3).
      gradedAnswers.push({ question_id: question.id, response: submitted.response, is_correct: null, points_awarded: null });
    }
  }

  const scorePercent = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
  const passed = scorePercent >= (activity.passing_score_percent ?? 60);
  const gradeReleased = activity.kind === "practice" ? true : activity.grade_visibility === "released";

  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      activity_id: activityId,
      student_id: user.id,
      attempt_number: attemptNumber,
      submitted_at: now.toISOString(),
      score_percent: scorePercent,
      raw_score: rawScore,
      max_score: maxScore,
      passed,
      grade_released: gradeReleased,
    })
    .select("id")
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: attemptError?.message ?? "Could not save attempt." }, { status: 500 });
  }

  await supabase.from("attempt_answers").insert(
    gradedAnswers.map((a) => ({ ...a, attempt_id: attempt.id })),
  );

  // Coin logic only applies to practices with rewards enabled (never
  // tests - enforced again here even though the DB constraint already
  // guarantees coin_rewards_enabled is false for kind = 'test').
  let coinsAwarded = 0;
  let tierReached: 1 | 2 | 3 | null = null;

  if (activity.kind === "practice" && activity.coin_rewards_enabled) {
    // Reading existing tier history and writing the balance/transaction
    // needs to bypass RLS (students can't write coin_transactions or
    // practice_reward_history directly - see migration 0002), so this
    // part runs through the trusted admin client. In a high-concurrency
    // production deployment, wrap this section in a Postgres function
    // (SECURITY DEFINER) called via `.rpc()` for atomicity; a plain
    // read-modify-write is adequate for Phase 1 classroom-scale traffic.
    const admin = createAdminSupabaseClient();

    const { data: history } = await admin
      .from("practice_reward_history")
      .select("tier")
      .eq("student_id", user.id)
      .eq("activity_id", activityId);

    const reward = computeCoinReward(scorePercent, history ?? []);
    coinsAwarded = reward.coinsAwarded;
    tierReached = reward.tierReached;

    if (reward.coinsAwarded > 0) {
      for (const update of reward.historyUpdates) {
        if (update.incrementTimesEarned) {
          await admin.rpc("increment_tier3_times_earned" as never, {
            p_student_id: user.id,
            p_activity_id: activityId,
          } as never);
        } else {
          await admin.from("practice_reward_history").upsert({
            student_id: user.id,
            activity_id: activityId,
            tier: update.tier,
          });
        }
      }

      await admin.from("coin_transactions").insert({
        student_id: user.id,
        amount: reward.coinsAwarded,
        reason: "practice_reward",
        related_attempt_id: attempt.id,
      });

      await admin.rpc("increment_coin_balance" as never, {
        p_student_id: user.id,
        p_amount: reward.coinsAwarded,
      } as never);
    }
  }

  return NextResponse.json({
    scorePercent,
    passed,
    coinsAwarded,
    tierReached,
    perQuestion: gradedAnswers.map((a) => ({ questionId: a.question_id, isCorrect: a.is_correct })),
  });
}
