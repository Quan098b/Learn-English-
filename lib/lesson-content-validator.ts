/**
 * Validation for the beginner learning content of a lesson: goals, theory,
 * worked examples, guided practice and structured explanations. All of it is
 * optional, so lessons written before these fields existed stay valid.
 */
import {
  LIMITS,
  QUESTION_ID_PATTERN,
  type Explanation,
  type GuidedPracticeItem,
  type LessonExample,
  type SentencePart,
  type TheoryItem,
  type TheorySection,
} from "./lesson-schema.ts";

export type Issue = { where: string; message: string; fix: string };

export type Reporter = {
  error(where: string, message: string, fix: string): void;
  warn(where: string, message: string, fix: string): void;
};

type Obj = Record<string, unknown>;

export function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Firebase stores arrays as objects with numeric keys and drops empty arrays;
 * accept both forms when reading lessons back from the database.
 */
export function asArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (isObj(value) && Object.keys(value).every((k) => /^\d+$/.test(k))) {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => value[k]);
  }
  return null;
}

export function checkKeys(r: Reporter, obj: Obj, allowed: string[], where: string) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      r.error(where, `Trường "${key}" không thuộc schema.`, `Xoá "${key}" hoặc sửa đúng tên. Các trường hợp lệ: ${allowed.join(", ")}.`);
    }
  }
}

/** Optional/required trimmed string with a length limit. */
export function str(
  r: Reporter,
  obj: Obj,
  key: string,
  where: string,
  max: number,
  required = false,
): string | undefined {
  const value = obj[key];
  if (value === undefined || value === null) {
    if (required) r.error(where, `Thiếu "${key}".`, `Thêm "${key}": "..." (chuỗi không rỗng).`);
    return undefined;
  }
  if (typeof value !== "string") {
    r.error(where, `"${key}" phải là chuỗi.`, `Đặt "${key}" trong dấu ngoặc kép.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) r.error(where, `"${key}" đang rỗng.`, `Nhập nội dung cho "${key}".`);
    return undefined;
  }
  if (trimmed.length > max) {
    r.error(where, `"${key}" dài ${trimmed.length} ký tự (tối đa ${max}).`, `Rút gọn "${key}".`);
    return undefined;
  }
  return trimmed;
}

/** Optional array of non-empty strings. */
export function strList(
  r: Reporter,
  value: unknown,
  where: string,
  key: string,
  limits: { maxItems: number; maxLength: number },
): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = asArray(value);
  if (!list || !list.every((s) => typeof s === "string" && s.trim())) {
    r.error(where, `"${key}" phải là mảng chuỗi không rỗng.`, `Ví dụ "${key}": ["...", "..."].`);
    return undefined;
  }
  if (list.length > limits.maxItems) {
    r.error(where, `"${key}" có ${list.length} phần tử (tối đa ${limits.maxItems}).`, "Bớt phần tử.");
    return undefined;
  }
  const items = (list as string[]).map((s) => s.trim());
  const tooLong = items.findIndex((s) => s.length > limits.maxLength);
  if (tooLong >= 0) {
    r.error(where, `"${key}"[${tooLong}] quá dài (tối đa ${limits.maxLength}).`, "Rút gọn hoặc tách thành nhiều dòng.");
    return undefined;
  }
  return items;
}

function id(r: Reporter, obj: Obj, where: string, seen: Set<string>, fallback: string): string {
  const raw = typeof obj.id === "string" ? obj.id.trim() : "";
  if (!raw) {
    r.error(where, `Thiếu "id".`, `Thêm "id": "${fallback}".`);
    return fallback;
  }
  if (!QUESTION_ID_PATTERN.test(raw) || raw.length > LIMITS.id) {
    r.error(where, `id "${raw}" không hợp lệ.`, "Chỉ dùng chữ, số, - và _.");
  } else if (seen.has(raw)) {
    r.error(where, `id "${raw}" bị trùng.`, "Đổi id để mỗi mục là duy nhất.");
  }
  seen.add(raw);
  return raw;
}

/** `explanation`: plain string (old format) or { summary, steps?, whyNot? }. */
export function validateExplanation(r: Reporter, value: unknown, where: string): Explanation | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > LIMITS.explanation) {
      r.error(where, `"explanation" quá dài.`, `Tối đa ${LIMITS.explanation} ký tự.`);
      return undefined;
    }
    return trimmed || undefined;
  }
  if (!isObj(value)) {
    r.error(where, `"explanation" phải là chuỗi hoặc object.`, `Dùng "explanation": "..." hoặc {"summary": "...", "steps": [...]}.`);
    return undefined;
  }
  const at = `${where} › explanation`;
  checkKeys(r, value, ["summary", "steps", "whyNot"], at);
  const summary = str(r, value, "summary", at, LIMITS.explanation, true);
  const steps = strList(r, value.steps, at, "steps", { maxItems: LIMITS.steps, maxLength: LIMITS.step });
  let whyNot: { answer: string; reason: string }[] | undefined;
  if (value.whyNot !== undefined) {
    const list = asArray(value.whyNot);
    if (!list) {
      r.error(at, `"whyNot" phải là mảng.`, `Ví dụ "whyNot": [{"answer": "We", "reason": "..."}].`);
    } else if (list.length > LIMITS.whyNot) {
      r.error(at, `"whyNot" có quá nhiều phần tử.`, `Tối đa ${LIMITS.whyNot}.`);
    } else {
      whyNot = [];
      list.forEach((item, i) => {
        const w = `${at} › whyNot[${i}]`;
        if (!isObj(item)) {
          r.error(w, "Phải là object.", `Dùng {"answer": "We", "reason": "..."}.`);
          return;
        }
        checkKeys(r, item, ["answer", "reason"], w);
        const answer = str(r, item, "answer", w, LIMITS.answerText, true);
        const reason = str(r, item, "reason", w, LIMITS.explanation, true);
        if (answer && reason) whyNot?.push({ answer, reason });
      });
    }
  }
  if (!summary) return undefined;
  return {
    summary,
    ...(steps?.length ? { steps } : {}),
    ...(whyNot?.length ? { whyNot } : {}),
  };
}

function validateBreakdown(r: Reporter, value: unknown, where: string): SentencePart[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = asArray(value);
  if (!list || list.length > LIMITS.breakdown) {
    r.error(where, `"breakdown" phải là mảng (tối đa ${LIMITS.breakdown} phần).`, `Ví dụ "breakdown": [{"text": "I", "meaning": "tôi", "role": "chủ ngữ"}].`);
    return undefined;
  }
  const parts: SentencePart[] = [];
  list.forEach((item, i) => {
    const w = `${where} › breakdown[${i}]`;
    if (!isObj(item)) {
      r.error(w, "Phải là object.", `Dùng {"text": "...", "meaning": "..."}.`);
      return;
    }
    checkKeys(r, item, ["text", "meaning", "role"], w);
    const text = str(r, item, "text", w, LIMITS.word, true);
    const meaning = str(r, item, "meaning", w, LIMITS.meaning);
    const role = str(r, item, "role", w, LIMITS.meaning);
    if (text) parts.push({ text, ...(meaning ? { meaning } : {}), ...(role ? { role } : {}) });
  });
  return parts;
}

export function validateGoals(r: Reporter, value: unknown): string[] | undefined {
  return strList(r, value, "goals", "goals", { maxItems: LIMITS.goals, maxLength: LIMITS.goal });
}

export function validateTheory(r: Reporter, value: unknown): TheorySection[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = asArray(value);
  if (!list) {
    r.error("theory", `"theory" phải là mảng.`, `Dùng "theory": [{"id": "t1", "title": "...", "body": ["..."]}].`);
    return undefined;
  }
  if (list.length > LIMITS.theory) {
    r.error("theory", `Có ${list.length} phần lý thuyết (tối đa ${LIMITS.theory}).`, "Chia thành nhiều bài.");
  }
  const seen = new Set<string>();
  const sections: TheorySection[] = [];
  list.forEach((raw, index) => {
    const where = `Lý thuyết ${index + 1}`;
    if (!isObj(raw)) {
      r.error(where, "Phải là object.", `Dùng {"id": "t${index + 1}", "title": "..."}.`);
      return;
    }
    checkKeys(r, raw, ["id", "title", "body", "items", "table", "tip"], where);
    const sectionId = id(r, raw, where, seen, `t${index + 1}`);
    const title = str(r, raw, "title", where, LIMITS.sectionTitle, true);
    const body = strList(r, raw.body, where, "body", { maxItems: LIMITS.paragraphs, maxLength: LIMITS.paragraph });
    const tip = str(r, raw, "tip", where, LIMITS.paragraph);

    let items: TheoryItem[] | undefined;
    if (raw.items !== undefined) {
      const itemList = asArray(raw.items);
      if (!itemList || itemList.length > LIMITS.items) {
        r.error(where, `"items" phải là mảng (tối đa ${LIMITS.items}).`, `Dùng "items": [{"term": "I", "meaning": "tôi"}].`);
      } else {
        items = [];
        itemList.forEach((item, i) => {
          const w = `${where} › items[${i}]`;
          if (!isObj(item)) {
            r.error(w, "Phải là object.", `Dùng {"term": "...", "meaning": "..."}.`);
            return;
          }
          checkKeys(r, item, ["term", "meaning", "usage", "example", "exampleMeaning", "note"], w);
          const term = str(r, item, "term", w, LIMITS.word, true);
          const fields = Object.fromEntries(
            (["meaning", "usage", "example", "exampleMeaning", "note"] as const)
              .map((k) => [k, str(r, item, k, w, LIMITS.paragraph)])
              .filter(([, v]) => v),
          );
          if (term) items?.push({ term, ...fields });
        });
      }
    }

    let table: TheorySection["table"];
    if (raw.table !== undefined) {
      const t = raw.table;
      const headers = isObj(t) ? asArray(t.headers) : null;
      const rows = isObj(t) ? asArray(t.rows) : null;
      const rowLists = rows?.map((row) => asArray(row));
      const ok =
        headers && rows && rowLists &&
        headers.length > 0 && headers.length <= LIMITS.tableCols &&
        rows.length > 0 && rows.length <= LIMITS.tableRows &&
        headers.every((h) => typeof h === "string" && h.length <= LIMITS.cell) &&
        rowLists.every((row) => row && row.length === headers.length && row.every((cell) => typeof cell === "string" && cell.length <= LIMITS.cell));
      if (!ok) {
        r.error(where, `"table" không hợp lệ.`, `Dùng {"headers": ["A", "B"], "rows": [["...", "..."]]} — mỗi hàng có đúng số cột như headers.`);
      } else {
        table = { headers: headers as string[], rows: rowLists as string[][] };
      }
    }

    if (!body?.length && !items?.length && !table && !tip) {
      r.error(where, "Phần lý thuyết chưa có nội dung.", `Thêm ít nhất một trong "body", "items", "table", "tip".`);
    }
    if (title) {
      sections.push({
        id: sectionId,
        title,
        ...(body?.length ? { body } : {}),
        ...(items?.length ? { items } : {}),
        ...(table ? { table } : {}),
        ...(tip ? { tip } : {}),
      });
    }
  });
  return sections;
}

export function validateExamples(r: Reporter, value: unknown): LessonExample[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = asArray(value);
  if (!list) {
    r.error("examples", `"examples" phải là mảng.`, `Dùng "examples": [{"id": "e1", "sentence": "..."}].`);
    return undefined;
  }
  if (list.length > LIMITS.examples) {
    r.error("examples", `Có ${list.length} ví dụ (tối đa ${LIMITS.examples}).`, "Bớt ví dụ.");
  }
  const seen = new Set<string>();
  const examples: LessonExample[] = [];
  list.forEach((raw, index) => {
    const where = `Ví dụ ${index + 1}`;
    if (!isObj(raw)) {
      r.error(where, "Phải là object.", `Dùng {"id": "e${index + 1}", "sentence": "..."}.`);
      return;
    }
    checkKeys(r, raw, ["id", "context", "sentence", "meaning", "steps", "breakdown", "speak"], where);
    const exampleId = id(r, raw, where, seen, `e${index + 1}`);
    const sentence = str(r, raw, "sentence", where, LIMITS.sentence, true);
    const context = str(r, raw, "context", where, LIMITS.sentence);
    const meaning = str(r, raw, "meaning", where, LIMITS.sentence);
    const speak = str(r, raw, "speak", where, LIMITS.speakSentence);
    const steps = strList(r, raw.steps, where, "steps", { maxItems: LIMITS.steps, maxLength: LIMITS.step });
    const breakdown = validateBreakdown(r, raw.breakdown, where);
    if (sentence) {
      examples.push({
        id: exampleId,
        sentence,
        ...(context ? { context } : {}),
        ...(meaning ? { meaning } : {}),
        ...(steps?.length ? { steps } : {}),
        ...(breakdown?.length ? { breakdown } : {}),
        ...(speak ? { speak } : {}),
      });
    }
  });
  return examples;
}

export function validateGuided(r: Reporter, value: unknown): GuidedPracticeItem[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = asArray(value);
  if (!list) {
    r.error("guidedPractice", `"guidedPractice" phải là mảng.`, `Dùng "guidedPractice": [{"id": "g1", "display": "... ___ ...", "correctAnswer": "...", "hints": ["..."]}].`);
    return undefined;
  }
  if (list.length > LIMITS.guided) {
    r.error("guidedPractice", `Có ${list.length} câu luyện (tối đa ${LIMITS.guided}).`, "Bớt câu.");
  }
  const seen = new Set<string>();
  const items: GuidedPracticeItem[] = [];
  list.forEach((raw, index) => {
    const where = `Luyện tập ${index + 1}`;
    if (!isObj(raw)) {
      r.error(where, "Phải là object.", `Dùng {"id": "g${index + 1}", "display": "...", "correctAnswer": "...", "hints": [...]}.`);
      return;
    }
    checkKeys(r, raw, ["id", "display", "prompt", "correctAnswer", "acceptedAnswers", "hints", "explanation", "speakSentence"], where);
    const itemId = id(r, raw, where, seen, `g${index + 1}`);
    const display = str(r, raw, "display", where, LIMITS.display, true);
    const prompt = str(r, raw, "prompt", where, LIMITS.prompt);
    const correctAnswer = str(r, raw, "correctAnswer", where, LIMITS.answerText, true);
    const acceptedAnswers = strList(r, raw.acceptedAnswers, where, "acceptedAnswers", { maxItems: LIMITS.acceptedAnswers, maxLength: LIMITS.answerText });
    const hints = strList(r, raw.hints, where, "hints", { maxItems: LIMITS.hints, maxLength: LIMITS.hint });
    if (!hints?.length && raw.hints === undefined) {
      r.error(where, `Thiếu "hints".`, `Thêm 1–${LIMITS.hints} gợi ý, mở dần từng cái: "hints": ["...", "..."].`);
    }
    const explanation = validateExplanation(r, raw.explanation, where);
    const speakSentence = str(r, raw, "speakSentence", where, LIMITS.speakSentence);
    if (display && !display.includes("___")) {
      r.warn(where, `Câu luyện không có chỗ trống "___".`, `Thêm "___" vào "display".`);
    }
    if (display && correctAnswer && hints?.length) {
      items.push({
        id: itemId,
        display,
        correctAnswer,
        hints,
        ...(prompt ? { prompt } : {}),
        ...(acceptedAnswers?.length ? { acceptedAnswers } : {}),
        ...(explanation ? { explanation } : {}),
        ...(speakSentence ? { speakSentence } : {}),
      });
    }
  });
  return items;
}
