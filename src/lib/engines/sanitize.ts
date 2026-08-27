import type { QuestionType } from "@/types/database";

export interface ClientQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  mediaUrl: string | null;
  // Type-specific, answer-free rendering data.
  render: Record<string, unknown>;
}

/**
 * Removes anything that would let a student read the correct answer out of
 * the network response before submitting. This matters even though RLS
 * already scopes `questions` rows, because a public/shared question's
 * `data` column legitimately contains the answer key for grading - it
 * must never reach the browser un-stripped for an in-progress attempt.
 *
 * IMPORTANT: this function must run server-side (Server Component or
 * Route Handler) on data fetched with a trusted read, before the question
 * is serialized into a client component's props.
 */
export function sanitizeQuestionForStudent(question: {
  id: string;
  type: QuestionType;
  prompt: string;
  media_url: string | null;
  data: Record<string, unknown>;
}): ClientQuestion {
  const base = { id: question.id, type: question.type, prompt: question.prompt, mediaUrl: question.media_url };

  switch (question.type) {
    case "fill_in_blank": {
      const blanks = (question.data.blanks as Array<unknown>) ?? [];
      return { ...base, render: { blankCount: blanks.length } };
    }
    case "multiple_choice": {
      const options = (question.data.options as Array<{ id: string; text: string }>) ?? [];
      return { ...base, render: { options } };
    }
    case "true_false": {
      return { ...base, render: {} };
    }
    case "matching": {
      const pairs = (question.data.pairs as Array<{ id: string; left: string; right: string }>) ?? [];
      const randomizeRight = (question.data.randomize_right_column as boolean) ?? true;
      const rightItems = pairs.map((p) => p.right);
      const shuffledRight = randomizeRight ? shuffleArray(rightItems) : rightItems;
      return {
        ...base,
        render: {
          leftItems: pairs.map((p) => ({ id: p.id, text: p.left })),
          rightItems: shuffledRight,
        },
      };
    }
    case "word_order": {
      const words = (question.data.words as string[]) ?? [];
      return { ...base, render: { words: shuffleArray(words) } };
    }
    default:
      return { ...base, render: {} };
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
