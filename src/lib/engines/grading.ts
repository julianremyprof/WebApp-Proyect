import {
  FillInBlankData,
  MatchingData,
  MultipleChoiceData,
  TrueFalseData,
  WordOrderData,
} from "./schemas";

export interface GradeResult {
  isCorrect: boolean;
  pointsAwarded: number; // out of `points` passed in
}

/** Normalizes a student's text answer for comparison: trims, collapses
 * internal whitespace runs to a single space, and optionally lowercases.
 * Matches spec section 12.2 ("optional case-insensitive grading, optional
 * extra-space normalization") and the Word Formation activity's explicit
 * "ignore capitalization / extra spaces" instruction. */
function normalize(value: string, caseSensitive: boolean): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

export function gradeFillInBlank(
  data: FillInBlankData,
  response: { blank_values: string[] },
  points: number,
): GradeResult {
  const blanks = data.blanks;
  if (response.blank_values.length !== blanks.length) {
    return { isCorrect: false, pointsAwarded: 0 };
  }

  const perBlank = blanks.map((blank, i) => {
    const given = normalize(response.blank_values[i] ?? "", blank.case_sensitive);
    return blank.accepted.some((accepted) => normalize(accepted, blank.case_sensitive) === given);
  });

  const allCorrect = perBlank.every(Boolean);
  // Multi-blank questions award partial credit proportional to correct
  // blanks; single-blank questions (the common case, incl. Word
  // Formation) are simply all-or-nothing.
  const fraction = perBlank.filter(Boolean).length / blanks.length;
  return {
    isCorrect: allCorrect,
    pointsAwarded: Math.round(points * fraction * 100) / 100,
  };
}

export function gradeMultipleChoice(
  data: MultipleChoiceData,
  response: { selected_option_ids: string[] },
  points: number,
): GradeResult {
  const correct = new Set(data.correct_option_ids);
  const selected = new Set(response.selected_option_ids);
  const isCorrect =
    correct.size === selected.size && [...correct].every((id) => selected.has(id));
  return { isCorrect, pointsAwarded: isCorrect ? points : 0 };
}

export function gradeTrueFalse(
  data: TrueFalseData,
  response: { answer: boolean },
  points: number,
): GradeResult {
  const isCorrect = data.correct_answer === response.answer;
  return { isCorrect, pointsAwarded: isCorrect ? points : 0 };
}

/** Partial credit: award points proportional to correctly matched pairs,
 * matching the spec's general "automatic grading" requirement for
 * Matching without over-penalizing one wrong pair among many. */
export function gradeMatching(
  data: MatchingData,
  response: { matches: Record<string, string> },
  points: number,
): GradeResult {
  const results = data.pairs.map((pair) => {
    const given = response.matches[pair.id];
    return normalize(given ?? "", false) === normalize(pair.right, false);
  });
  const allCorrect = results.every(Boolean);
  const fraction = results.filter(Boolean).length / results.length;
  return { isCorrect: allCorrect, pointsAwarded: Math.round(points * fraction * 100) / 100 };
}

/** All-or-nothing: the sentence is either in the correct order or it
 * isn't. The answer key is derived from `correct_sentence` (not the
 * scrambled `words` tile list, which is just what's presented to the
 * student) - trailing punctuation is stripped from each token so tiles
 * like "years" still match "years." at the end of the sentence. */
export function gradeWordOrder(
  data: WordOrderData,
  response: { ordered_words: string[] },
  points: number,
): GradeResult {
  const stripPunct = (w: string) => normalize(w, false).replace(/[.,!?;:]+$/, "");
  const expected = data.correct_sentence.trim().split(/\s+/).map(stripPunct);
  const given = response.ordered_words.map(stripPunct);
  const isCorrect = expected.length === given.length && expected.every((w, i) => w === given[i]);
  return { isCorrect, pointsAwarded: isCorrect ? points : 0 };
}
