import Papa from "papaparse";
import type { ImportableType } from "./templates";
import type {
  FillInBlankData,
  MatchingData,
  MultipleChoiceData,
  TrueFalseData,
  WordOrderData,
} from "@/lib/engines/schemas";

export interface ImportRowResult {
  row: number; // 1-based, matches spreadsheet row (header excluded)
  prompt: string;
  data: FillInBlankData | MultipleChoiceData | TrueFalseData | MatchingData | WordOrderData;
  errors: string[];
}

export interface ImportSummary {
  valid: ImportRowResult[];
  invalid: ImportRowResult[];
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
}

export function parseCsv(type: ImportableType, csvText: string): ImportSummary {
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parseErrors.length) {
    return {
      valid: [],
      invalid: [
        {
          row: 0,
          prompt: "",
          data: {} as never,
          errors: parseErrors.map((e) => `CSV parse error: ${e.message}`),
        },
      ],
    };
  }

  const valid: ImportRowResult[] = [];
  const invalid: ImportRowResult[] = [];

  // Matching is grouped: each CSV row is one pair, and rows sharing the
  // same `group` value become the pairs of a single question. Handled
  // separately from the per-row loop below because of that 1-question-per
  // multiple-rows shape.
  if (type === "matching") {
    const groups = new Map<string, { rows: number[]; pairs: Array<{ id: string; left: string; right: string }> }>();
    data.forEach((raw, i) => {
      const groupKey = raw.group?.trim() || "Ungrouped";
      const left = raw.left_item?.trim();
      const right = raw.right_item?.trim();
      const entry = groups.get(groupKey) ?? { rows: [], pairs: [] };
      entry.rows.push(i + 1);
      if (left && right) entry.pairs.push({ id: String(entry.pairs.length + 1), left, right });
      groups.set(groupKey, entry);
    });

    for (const [groupKey, entry] of groups) {
      const errors: string[] = [];
      if (entry.pairs.length < 2) errors.push(`Group "${groupKey}" needs at least 2 left/right pairs.`);

      const result: ImportRowResult = {
        row: entry.rows[0],
        prompt: `Match the items: ${groupKey}`,
        data: { pairs: entry.pairs, randomize_right_column: true },
        errors,
      };
      (errors.length ? invalid : valid).push(result);
    }

    return { valid, invalid };
  }

  data.forEach((raw, i) => {
    const rowNum = i + 1;
    const errors: string[] = [];

    if (type === "multiple_choice") {
      const question = raw.question?.trim();
      const options = [raw.answer1, raw.answer2, raw.answer3, raw.answer4]
        .map((v, idx) => ({ id: String(idx + 1), text: v?.trim() ?? "" }))
        .filter((o) => o.text.length > 0);
      const correctNum = raw.correct_answer_number?.trim();

      if (!question) errors.push("Missing question text.");
      if (options.length < 2) errors.push("Needs at least 2 non-empty answers.");
      if (!correctNum) errors.push("Missing correct_answer_number.");
      else if (!options.some((o) => o.id === correctNum)) {
        errors.push(`correct_answer_number "${correctNum}" doesn't match any answer column.`);
      }

      const result: ImportRowResult = {
        row: rowNum,
        prompt: question ?? "",
        data: { options, correct_option_ids: correctNum ? [correctNum] : [] },
        errors,
      };
      (errors.length ? invalid : valid).push(result);
      return;
    }

    if (type === "fill_in_blank") {
      const sentence = raw.sentence?.trim();
      const answer = raw.answer?.trim();
      const alternatives = raw.alternative_answers?.split("|").map((a) => a.trim()).filter(Boolean) ?? [];

      if (!sentence) errors.push("Missing sentence.");
      if (!sentence?.includes("__________") && !sentence?.includes("___")) {
        errors.push('Sentence should contain a blank marker, e.g. "__________".');
      }
      if (!answer) errors.push("Missing answer.");

      const result: ImportRowResult = {
        row: rowNum,
        prompt: sentence ?? "",
        data: {
          blanks: [
            {
              accepted: answer ? [answer, ...alternatives] : alternatives,
              case_sensitive: parseBool(raw.case_sensitive, false),
            },
          ],
        },
        errors,
      };
      (errors.length ? invalid : valid).push(result);
      return;
    }

    if (type === "word_order") {
      const sentence = raw.correct_sentence?.trim();
      const words = raw.words?.split("|").map((w) => w.trim()).filter(Boolean) ?? [];

      if (!sentence) errors.push("Missing correct_sentence.");
      if (words.length < 2) errors.push("Needs at least 2 words in the words column.");

      const result: ImportRowResult = {
        row: rowNum,
        prompt: sentence ?? "",
        data: { correct_sentence: sentence ?? "", words },
        errors,
      };
      (errors.length ? invalid : valid).push(result);
      return;
    }

    // true_false
    const statement = raw.statement?.trim();
    const correctRaw = raw.correct_answer?.trim().toLowerCase();
    if (!statement) errors.push("Missing statement.");
    if (correctRaw !== "true" && correctRaw !== "false") {
      errors.push('correct_answer must be exactly "true" or "false".');
    }

    const result: ImportRowResult = {
      row: rowNum,
      prompt: statement ?? "",
      data: { correct_answer: correctRaw === "true" },
      errors,
    };
    (errors.length ? invalid : valid).push(result);
  });

  return { valid, invalid };
}
