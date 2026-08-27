import { z } from "zod";

/**
 * Validates the `questions.data` JSONB payload for each supported Phase 1
 * question type. Phase 2/3 types (matching, word_order, short_answer,
 * essay, listening, image_based, speaking) are declared in the DB enum
 * already (see migration 0001) but their schemas are added here as each
 * engine ships, so existing rows are never invalidated by a later change.
 */

export const multipleChoiceDataSchema = z.object({
  options: z.array(z.object({ id: z.string(), text: z.string() })).min(2),
  correct_option_ids: z.array(z.string()).min(1),
});
export type MultipleChoiceData = z.infer<typeof multipleChoiceDataSchema>;

export const fillInBlankDataSchema = z.object({
  base_word: z.string().optional(),
  blanks: z
    .array(
      z.object({
        accepted: z.array(z.string()).min(1),
        case_sensitive: z.boolean().default(false),
      }),
    )
    .min(1),
});
export type FillInBlankData = z.infer<typeof fillInBlankDataSchema>;

export const trueFalseDataSchema = z.object({
  correct_answer: z.boolean(),
});
export type TrueFalseData = z.infer<typeof trueFalseDataSchema>;

export const matchingDataSchema = z.object({
  pairs: z
    .array(z.object({ id: z.string(), left: z.string(), right: z.string() }))
    .min(2),
  randomize_right_column: z.boolean().default(true),
});
export type MatchingData = z.infer<typeof matchingDataSchema>;

export const wordOrderDataSchema = z.object({
  correct_sentence: z.string(),
  words: z.array(z.string()).min(2),
});
export type WordOrderData = z.infer<typeof wordOrderDataSchema>;

// ---- student response payloads (attempt_answers.response) ----

export const multipleChoiceResponseSchema = z.object({
  selected_option_ids: z.array(z.string()),
});

export const fillInBlankResponseSchema = z.object({
  blank_values: z.array(z.string()),
});

export const trueFalseResponseSchema = z.object({
  answer: z.boolean(),
});

export const matchingResponseSchema = z.object({
  // Maps each pair's `id` (the left item) to the right-column text the
  // student chose for it.
  matches: z.record(z.string(), z.string()),
});

export const wordOrderResponseSchema = z.object({
  ordered_words: z.array(z.string()),
});
