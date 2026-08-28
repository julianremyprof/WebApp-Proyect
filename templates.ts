export type ImportableType = "multiple_choice" | "fill_in_blank" | "true_false" | "matching" | "word_order";

interface CsvTemplate {
  type: ImportableType;
  label: string;
  columns: string[];
  exampleRow: string[];
  /** Rendered as the downloadable .csv template. */
  toCsvString(): string;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildTemplate(type: ImportableType, label: string, columns: string[], exampleRow: string[]): CsvTemplate {
  return {
    type,
    label,
    columns,
    exampleRow,
    toCsvString() {
      return [columns, exampleRow].map((row) => row.map(csvEscape).join(",")).join("\n");
    },
  };
}

export const CSV_TEMPLATES: Record<ImportableType, CsvTemplate> = {
  multiple_choice: buildTemplate(
    "multiple_choice",
    "Multiple Choice",
    ["question", "answer1", "answer2", "answer3", "answer4", "correct_answer_number", "explanation"],
    ["What is the past tense of go?", "goed", "went", "gone", "go", "2", "The past tense of go is went."],
  ),
  fill_in_blank: buildTemplate(
    "fill_in_blank",
    "Fill in the Blank",
    ["sentence", "answer", "alternative_answers", "case_sensitive", "instant_feedback", "explanation"],
    [
      "How long is the __________ from Rome to Paris?",
      "flight",
      "journey|trip",
      "false",
      "true",
      "Flight is the noun form related to fly.",
    ],
  ),
  true_false: buildTemplate(
    "true_false",
    "True / False",
    ["statement", "correct_answer", "explanation"],
    ["London is the capital of France.", "false", "The capital of France is Paris."],
  ),
  matching: buildTemplate(
    "matching",
    "Matching",
    ["left_item", "right_item", "group", "explanation"],
    ["reliable", "someone you can trust", "personality adjectives", ""],
  ),
  word_order: buildTemplate(
    "word_order",
    "Word Order",
    ["correct_sentence", "words"],
    ["She has lived here for five years.", "She|has|lived|here|for|five|years"],
  ),
};
