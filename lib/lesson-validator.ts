import {
  CHOICE_QUESTION_TYPES,
  LESSON_ID_PATTERN,
  LESSON_LEVELS,
  LESSON_SCHEMA_VERSION,
  LIMITS,
  OPTION_ID_PATTERN,
  QUESTION_ID_PATTERN,
  QUESTION_TYPES,
  type Lesson,
  type LessonAudio,
  type Question,
  type QuestionOption,
  type VocabularyItem,
} from "./lesson-schema.ts";

export type ValidationIssue = {
  /** Where the problem is, e.g. "Câu 7 (q7) › correctAnswer" or "Dòng 12". */
  where: string;
  message: string;
  fix: string;
};

export type ValidationResult =
  | { ok: true; lesson: Lesson; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[]; warnings: ValidationIssue[] };

type Obj = Record<string, unknown>;

const TOP_LEVEL_KEYS = [
  "schemaVersion", "id", "order", "title", "description", "level",
  "published", "audio", "vocabulary", "questions",
];
const QUESTION_KEYS = [
  "id", "type", "prompt", "display", "speak", "speakSentence", "explanation",
  "options", "correctAnswer", "acceptedAnswers",
];
const VOCAB_KEYS = ["word", "ipa", "meaning", "speak", "example"];
const AUDIO_KEYS = ["enabled", "mode", "language", "rate"];

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Firebase stores arrays as objects with numeric keys and drops empty arrays;
 * accept both forms when reading lessons back from the database.
 */
function asArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (isObj(value) && Object.keys(value).every((k) => /^\d+$/.test(k))) {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => value[k]);
  }
  return null;
}

class Collector {
  errors: ValidationIssue[] = [];
  warnings: ValidationIssue[] = [];
  error(where: string, message: string, fix: string) {
    this.errors.push({ where, message, fix });
  }
  warn(where: string, message: string, fix: string) {
    this.warnings.push({ where, message, fix });
  }
}

function checkUnknownKeys(c: Collector, obj: Obj, allowed: string[], where: string) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      c.error(
        where,
        `Trường "${key}" không thuộc schema.`,
        `Xoá "${key}" hoặc sửa đúng tên. Các trường hợp lệ: ${allowed.join(", ")}.`,
      );
    }
  }
}

function text(
  c: Collector,
  obj: Obj,
  key: string,
  where: string,
  opts: { required: boolean; max: number },
): string | undefined {
  const value = obj[key];
  if (value === undefined || value === null) {
    if (opts.required) {
      c.error(where, `Thiếu "${key}".`, `Thêm "${key}": "..." (chuỗi không rỗng).`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    c.error(where, `"${key}" phải là chuỗi.`, `Đặt "${key}" trong dấu ngoặc kép.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (opts.required) c.error(where, `"${key}" đang rỗng.`, `Nhập nội dung cho "${key}".`);
    return undefined;
  }
  if (trimmed.length > opts.max) {
    c.error(where, `"${key}" dài ${trimmed.length} ký tự (tối đa ${opts.max}).`, `Rút gọn "${key}".`);
    return undefined;
  }
  return trimmed;
}

function validateOptions(c: Collector, raw: unknown, where: string): QuestionOption[] | null {
  const list = asArray(raw);
  if (!list) {
    c.error(where, `"options" phải là một mảng.`, `Dùng dạng "options": [{"id": "A", "text": "..."}, ...].`);
    return null;
  }
  if (list.length < LIMITS.optionsMin || list.length > LIMITS.optionsMax) {
    c.error(
      where,
      `Có ${list.length} lựa chọn (cần ${LIMITS.optionsMin}–${LIMITS.optionsMax}).`,
      `Thêm hoặc bớt phần tử trong "options".`,
    );
  }
  const options: QuestionOption[] = [];
  const seen = new Set<string>();
  list.forEach((item, index) => {
    const at = `${where} › options[${index}]`;
    if (!isObj(item)) {
      c.error(at, "Lựa chọn phải là object.", `Dùng {"id": "A", "text": "..."}.`);
      return;
    }
    checkUnknownKeys(c, item, ["id", "text"], at);
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!OPTION_ID_PATTERN.test(id)) {
      c.error(at, `id lựa chọn "${String(item.id ?? "")}" không hợp lệ.`, `Dùng chữ/số ngắn như "A", "B", "C", "D".`);
    } else if (seen.has(id)) {
      c.error(at, `id lựa chọn "${id}" bị trùng.`, "Mỗi lựa chọn cần id riêng.");
    }
    seen.add(id);
    const label = text(c, item, "text", at, { required: true, max: LIMITS.optionText });
    if (id && label) options.push({ id, text: label });
  });
  return options;
}

function validateQuestion(c: Collector, raw: unknown, index: number, ids: Set<string>): Question | null {
  const fallback = `Câu ${index + 1}`;
  if (!isObj(raw)) {
    c.error(fallback, "Câu hỏi phải là object.", "Kiểm tra dấu { } của câu hỏi.");
    return null;
  }
  const rawId = typeof raw.id === "string" ? raw.id.trim() : "";
  const where = rawId ? `Câu ${index + 1} (${rawId})` : fallback;
  const errorCount = c.errors.length;
  checkUnknownKeys(c, raw, QUESTION_KEYS, where);

  if (!rawId) {
    c.error(where, `Thiếu "id".`, `Thêm "id": "q${index + 1}".`);
  } else if (!QUESTION_ID_PATTERN.test(rawId) || rawId.length > LIMITS.id) {
    c.error(where, `id "${rawId}" chứa ký tự không hợp lệ.`, "Chỉ dùng chữ, số, - và _ (không dùng / . # $ [ ]).");
  } else if (ids.has(rawId)) {
    c.error(where, `id câu hỏi "${rawId}" bị trùng.`, "Đổi id để mỗi câu là duy nhất.");
  }
  ids.add(rawId);

  const type = raw.type;
  if (typeof type !== "string" || !(QUESTION_TYPES as readonly string[]).includes(type)) {
    c.error(where, `"type" = ${JSON.stringify(type)} không được hỗ trợ.`, `Dùng một trong: ${QUESTION_TYPES.join(", ")}.`);
    return null;
  }

  const prompt = text(c, raw, "prompt", where, { required: true, max: LIMITS.prompt });
  const display = text(c, raw, "display", where, { required: false, max: LIMITS.display });
  const speak = text(c, raw, "speak", where, { required: type === "listen_choose", max: LIMITS.speak });
  const speakSentence = text(c, raw, "speakSentence", where, { required: false, max: LIMITS.speakSentence });
  const explanation = text(c, raw, "explanation", where, { required: false, max: LIMITS.explanation });
  if (type === "listen_choose" && raw.speak === undefined) {
    // Message already added by text(); make the fix explicit.
    c.errors[c.errors.length - 1].fix = `Câu "listen_choose" cần "speak": từ sẽ được đọc lên.`;
  }

  const base = {
    id: rawId,
    prompt: prompt ?? "",
    ...(display ? { display } : {}),
    ...(speak ? { speak } : {}),
    ...(speakSentence ? { speakSentence } : {}),
    ...(explanation ? { explanation } : {}),
  };

  const correct = typeof raw.correctAnswer === "string" ? raw.correctAnswer.trim() : "";
  if (!correct) {
    c.error(where, `Thiếu "correctAnswer".`, (CHOICE_QUESTION_TYPES as readonly string[]).includes(type)
      ? `Thêm "correctAnswer": id của lựa chọn đúng, ví dụ "B".`
      : `Thêm "correctAnswer": từ đúng, ví dụ "She".`);
  } else if (correct.length > LIMITS.answerText) {
    c.error(where, `"correctAnswer" quá dài.`, `Tối đa ${LIMITS.answerText} ký tự.`);
  }

  let question: Question | null = null;
  if (type === "fill_blank") {
    let options: QuestionOption[] | undefined;
    if (raw.options !== undefined) {
      options = validateOptions(c, raw.options, where) ?? undefined;
    }
    let acceptedAnswers: string[] | undefined;
    if (raw.acceptedAnswers !== undefined) {
      const list = asArray(raw.acceptedAnswers);
      if (!list || !list.every((a) => typeof a === "string" && a.trim() && a.length <= LIMITS.answerText)) {
        c.error(where, `"acceptedAnswers" phải là mảng chuỗi không rỗng.`, `Ví dụ "acceptedAnswers": ["she", "She"].`);
      } else if (list.length > LIMITS.acceptedAnswers) {
        c.error(where, `"acceptedAnswers" có quá nhiều phần tử.`, `Tối đa ${LIMITS.acceptedAnswers}.`);
      } else {
        acceptedAnswers = (list as string[]).map((a) => a.trim());
      }
    }
    if (options && options.length > 0 && correct && !options.some((o) => o.id === correct)) {
      c.error(where, `correctAnswer "${correct}" không tồn tại trong options.`, `Khi có "options", "correctAnswer" phải là id của một lựa chọn (${options.map((o) => o.id).join(", ")}).`);
    }
    if (prompt && !prompt.includes("___") && !display?.includes("___")) {
      c.warn(where, `Câu điền từ không có chỗ trống "___".`, `Thêm "___" vào "prompt" hoặc "display".`);
    }
    question = {
      ...base,
      type: "fill_blank",
      correctAnswer: correct,
      ...(acceptedAnswers?.length ? { acceptedAnswers } : {}),
      ...(options?.length ? { options } : {}),
    };
  } else {
    if (raw.acceptedAnswers !== undefined) {
      c.error(where, `"acceptedAnswers" chỉ dùng cho fill_blank.`, `Xoá "acceptedAnswers".`);
    }
    const options = raw.options === undefined
      ? (c.error(where, `Thiếu "options".`, `Câu "${type}" cần ít nhất ${LIMITS.optionsMin} lựa chọn.`), null)
      : validateOptions(c, raw.options, where);
    if (options && correct && !options.some((o) => o.id === correct)) {
      c.error(where, `correctAnswer "${correct}" không tồn tại trong options.`, `Đặt "correctAnswer" là một trong: ${options.map((o) => o.id).join(", ")}.`);
    }
    question = {
      ...base,
      type: type as Question["type"] & Exclude<Question["type"], "fill_blank">,
      options: options ?? [],
      correctAnswer: correct,
    };
  }
  return c.errors.length === errorCount ? question : null;
}

function validateVocabulary(c: Collector, raw: unknown): VocabularyItem[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  const list = asArray(raw);
  if (!list) {
    c.error("vocabulary", `"vocabulary" phải là một mảng.`, `Dùng dạng "vocabulary": [{"word": "...", "meaning": "..."}].`);
    return undefined;
  }
  if (list.length > LIMITS.vocabulary) {
    c.error("vocabulary", `Có ${list.length} từ (tối đa ${LIMITS.vocabulary}).`, "Chia thành nhiều bài.");
  }
  const items: VocabularyItem[] = [];
  list.forEach((item, index) => {
    const where = `Từ vựng ${index + 1}`;
    if (!isObj(item)) {
      c.error(where, "Mỗi từ phải là object.", `Dùng {"word": "they", "meaning": "họ"}.`);
      return;
    }
    checkUnknownKeys(c, item, VOCAB_KEYS, where);
    const word = text(c, item, "word", where, { required: true, max: LIMITS.word });
    const meaning = text(c, item, "meaning", where, { required: true, max: LIMITS.meaning });
    const ipa = text(c, item, "ipa", where, { required: false, max: LIMITS.ipa });
    const speak = text(c, item, "speak", where, { required: false, max: LIMITS.speak });
    const example = text(c, item, "example", where, { required: false, max: LIMITS.example });
    if (word && meaning) {
      items.push({
        word,
        meaning,
        ...(ipa ? { ipa } : {}),
        ...(speak ? { speak } : {}),
        ...(example ? { example } : {}),
      });
    }
  });
  return items;
}

function validateAudio(c: Collector, raw: unknown): LessonAudio | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObj(raw)) {
    c.error("audio", `"audio" phải là object.`, `Ví dụ "audio": {"enabled": true, "mode": "tts"}.`);
    return undefined;
  }
  checkUnknownKeys(c, raw, AUDIO_KEYS, "audio");
  if (typeof raw.enabled !== "boolean") {
    c.error("audio", `"audio.enabled" phải là true hoặc false.`, `Đặt "enabled": true.`);
  }
  if (raw.mode !== "tts" && raw.mode !== "file") {
    c.error("audio", `"audio.mode" = ${JSON.stringify(raw.mode)} không hợp lệ.`, `Dùng "tts".`);
  } else if (raw.mode === "file") {
    c.warn("audio", `"audio.mode": "file" chưa được hỗ trợ, sẽ dùng giọng đọc tự động.`, `Dùng "tts".`);
  }
  let language: string | undefined;
  if (raw.language !== undefined) {
    if (typeof raw.language !== "string" || !/^en(-[A-Z]{2})?$/.test(raw.language)) {
      c.error("audio", `"audio.language" = ${JSON.stringify(raw.language)} không hợp lệ.`, `Dùng "en-US" hoặc "en-GB", hoặc bỏ trường này để theo cài đặt của học viên.`);
    } else {
      language = raw.language;
    }
  }
  let rate: number | undefined;
  if (raw.rate !== undefined) {
    if (typeof raw.rate !== "number" || raw.rate < 0.5 || raw.rate > 1.5) {
      c.error("audio", `"audio.rate" phải là số từ 0.5 đến 1.5.`, `Ví dụ "rate": 0.85.`);
    } else {
      rate = raw.rate;
    }
  }
  return {
    enabled: raw.enabled === true,
    mode: raw.mode === "file" ? "file" : "tts",
    ...(language ? { language } : {}),
    ...(rate !== undefined ? { rate } : {}),
  };
}

/** Validates an already-parsed lesson object. */
export function validateLesson(raw: unknown): ValidationResult {
  const c = new Collector();
  if (!isObj(raw)) {
    c.error("Toàn bộ file", "Nội dung phải là một object JSON { ... }.", "Bắt đầu file bằng { và kết thúc bằng }.");
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  checkUnknownKeys(c, raw, TOP_LEVEL_KEYS, "Bài học");

  if (raw.schemaVersion !== LESSON_SCHEMA_VERSION) {
    c.error("schemaVersion", `schemaVersion = ${JSON.stringify(raw.schemaVersion)}.`, `Đặt "schemaVersion": ${LESSON_SCHEMA_VERSION}.`);
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) {
    c.error("id", `Thiếu "id".`, `Thêm "id", ví dụ "pronouns-01".`);
  } else if (!LESSON_ID_PATTERN.test(id) || id.length > LIMITS.id) {
    c.error("id", `id "${id}" không hợp lệ.`, `Chỉ dùng a-z, 0-9, - và _ (không viết hoa, không dùng / . # $ [ ]), tối đa ${LIMITS.id} ký tự.`);
  }

  const title = text(c, raw, "title", "title", { required: true, max: LIMITS.title });
  const description = text(c, raw, "description", "description", { required: false, max: LIMITS.description });

  let order = 0;
  if (raw.order === undefined) {
    c.warn("order", `Thiếu "order", mặc định là 0.`, `Thêm "order": 1 để sắp xếp bài.`);
  } else if (typeof raw.order !== "number" || !Number.isInteger(raw.order) || raw.order < 0 || raw.order > 100000) {
    c.error("order", `"order" phải là số nguyên ≥ 0.`, `Ví dụ "order": 1.`);
  } else {
    order = raw.order;
  }

  const level = raw.level;
  if (typeof level !== "string" || !(LESSON_LEVELS as readonly string[]).includes(level)) {
    c.error("level", `level = ${JSON.stringify(level)} không hợp lệ.`, `Dùng một trong: ${LESSON_LEVELS.join(", ")}.`);
  }

  if (typeof raw.published !== "boolean") {
    c.error("published", `"published" phải là true hoặc false.`, `Đặt "published": true để học viên thấy bài.`);
  }

  const audio = validateAudio(c, raw.audio);
  const vocabulary = validateVocabulary(c, raw.vocabulary);

  const questions: Question[] = [];
  const list = asArray(raw.questions);
  if (!list) {
    c.error("questions", `Thiếu "questions" hoặc không phải mảng.`, `Thêm "questions": [ ... ] với ít nhất 1 câu.`);
  } else if (list.length === 0) {
    c.error("questions", "Bài chưa có câu hỏi nào.", "Thêm ít nhất 1 câu hỏi.");
  } else if (list.length > LIMITS.questions) {
    c.error("questions", `Có ${list.length} câu (tối đa ${LIMITS.questions}).`, "Chia thành nhiều bài.");
  } else {
    const ids = new Set<string>();
    list.forEach((item, index) => {
      const question = validateQuestion(c, item, index, ids);
      if (question) questions.push(question);
    });
  }

  if (c.errors.length > 0) return { ok: false, errors: c.errors, warnings: c.warnings };

  const lesson: Lesson = {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id,
    order,
    title: title ?? "",
    ...(description ? { description } : {}),
    level: level as Lesson["level"],
    published: raw.published as boolean,
    ...(audio ? { audio } : {}),
    ...(vocabulary && vocabulary.length > 0 ? { vocabulary } : {}),
    questions,
  };
  return { ok: true, lesson, warnings: c.warnings };
}

const BOM = String.fromCharCode(0xfeff);

function lineOf(source: string, position: number): number {
  return source.slice(0, position).split("\n").length;
}

/** Parses the text of a `.lesson.json` file and validates it. */
export function parseLessonFile(source: string): ValidationResult {
  const cleaned = source.startsWith(BOM) ? source.slice(1) : source;
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lineMatch = /line (\d+)/i.exec(message);
    const posMatch = /position (\d+)/i.exec(message);
    const line = lineMatch ? Number(lineMatch[1]) : posMatch ? lineOf(cleaned, Number(posMatch[1])) : null;
    return {
      ok: false,
      warnings: [],
      errors: [{
        where: line ? `Dòng ${line}` : "File",
        message: `JSON không hợp lệ: ${message}`,
        fix: "Kiểm tra dấu phẩy thừa/thiếu, dấu ngoặc kép và ngoặc { } [ ] quanh vị trí này.",
      }],
    };
  }
  return validateLesson(data);
}

export function isLessonFileName(name: string): boolean {
  return /\.json$/i.test(name);
}
