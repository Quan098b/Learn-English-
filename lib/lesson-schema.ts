/**
 * Lesson file format, schemaVersion 1. Documented in docs/LESSON_FORMAT.md.
 * A lesson is stored as-is under `lessons/{id}` in the Realtime Database and
 * is also the content of a `*.lesson.json` import file.
 */

export const LESSON_SCHEMA_VERSION = 1;

export const LESSON_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type LessonLevel = (typeof LESSON_LEVELS)[number];

/** Question types where the learner picks one of `options`. */
export const CHOICE_QUESTION_TYPES = [
  "multiple_choice",
  "listen_choose",
  "word_to_meaning",
  "meaning_to_word",
  "ipa_to_word",
] as const;
export type ChoiceQuestionType = (typeof CHOICE_QUESTION_TYPES)[number];

export const QUESTION_TYPES = [...CHOICE_QUESTION_TYPES, "fill_blank"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type AudioMode = "tts" | "file";

export type LessonAudio = {
  enabled: boolean;
  /** Only "tts" (browser speech synthesis) is played in this version. */
  mode: AudioMode;
  /** BCP-47 tag such as "en-US"/"en-GB". When omitted the learner's accent setting is used. */
  language?: string;
  /** Speech rate, 0.5–1.5. Defaults to 0.85. */
  rate?: number;
};

export type VocabularyItem = {
  word: string;
  ipa?: string;
  meaning: string;
  /** Text to pronounce; defaults to `word`. */
  speak?: string;
  example?: string;
};

export type QuestionOption = {
  id: string;
  text: string;
};

type QuestionBase = {
  id: string;
  prompt: string;
  /** Large highlighted text above the prompt (word, IPA, sentence...). */
  display?: string;
  /** Word or phrase played by the 🔊 button. Never IPA. */
  speak?: string;
  /** Full sentence played by the "Nghe câu" button. */
  speakSentence?: string;
  explanation?: string;
};

export type ChoiceQuestion = QuestionBase & {
  type: ChoiceQuestionType;
  options: QuestionOption[];
  /** Id of the correct option. */
  correctAnswer: string;
};

/** Always a typed answer: the learner types the missing word. */
export type FillBlankQuestion = QuestionBase & {
  type: "fill_blank";
  /** The expected word, compared case-insensitively and trimmed. */
  correctAnswer: string;
  acceptedAnswers?: string[];
  /**
   * @deprecated Legacy data only (old lessons stored A/B/C/D options with
   * `correctAnswer` = option id). Never rendered; used to resolve the
   * expected text. New lessons and the editor never write it.
   */
  options?: QuestionOption[];
};

export type Question = ChoiceQuestion | FillBlankQuestion;

export type Lesson = {
  schemaVersion: typeof LESSON_SCHEMA_VERSION;
  id: string;
  order: number;
  title: string;
  description?: string;
  level: LessonLevel;
  published: boolean;
  audio?: LessonAudio;
  vocabulary?: VocabularyItem[];
  questions: Question[];
};

export const LIMITS = {
  id: 64,
  title: 120,
  description: 500,
  questions: 200,
  vocabulary: 500,
  prompt: 500,
  display: 300,
  speak: 200,
  speakSentence: 500,
  explanation: 1000,
  optionText: 200,
  optionsMin: 2,
  optionsMax: 8,
  word: 100,
  ipa: 100,
  meaning: 200,
  example: 300,
  acceptedAnswers: 20,
  answerText: 100,
} as const;

/** Allowed in lesson and question ids — safe as Firebase keys. */
export const LESSON_ID_PATTERN = /^[a-z0-9_-]+$/;
export const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
export const OPTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;

export function isChoiceQuestion(question: Question): question is ChoiceQuestion {
  return (CHOICE_QUESTION_TYPES as readonly string[]).includes(question.type);
}

/** Options shown to the learner; always null for fill_blank (typed answer). */
export function questionOptions(question: Question): QuestionOption[] | null {
  return isChoiceQuestion(question) ? question.options : null;
}

/** Instruction shown above a fill_blank, independent of legacy prompts. */
export const FILL_BLANK_INSTRUCTION = "Nhập từ còn thiếu vào chỗ trống.";

/**
 * The text expected for a fill_blank. Legacy questions stored the id of an
 * option ("B") — resolve it to that option's text ("She").
 */
export function fillBlankAnswer(question: FillBlankQuestion): string {
  const legacy = question.options?.find((o) => o.id === question.correctAnswer);
  return legacy ? legacy.text : question.correctAnswer;
}

/** Every typed answer accepted for a fill_blank (correct answer first). */
export function fillBlankAcceptedAnswers(question: FillBlankQuestion): string[] {
  const answers = [fillBlankAnswer(question), ...(question.acceptedAnswers ?? [])];
  return [...new Set(answers.map((a) => a.trim()).filter(Boolean))];
}

export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/, "")
    .toLowerCase();
}

/** `answer` is an option id for choice questions, or typed text otherwise. */
export function isAnswerCorrect(question: Question, answer: string): boolean {
  if (question.type !== "fill_blank") return answer === question.correctAnswer;
  const typed = normalizeAnswer(answer);
  return typed !== "" && fillBlankAcceptedAnswers(question).map(normalizeAnswer).includes(typed);
}

/** Human-readable correct answer for feedback ("She", never a legacy "B"). */
export function correctAnswerLabel(question: Question): string {
  if (question.type === "fill_blank") return fillBlankAnswer(question);
  const option = question.options.find((o) => o.id === question.correctAnswer);
  return option ? `${option.id}. ${option.text}` : question.correctAnswer;
}

export function sortLessons<T extends Pick<Lesson, "order" | "title">>(lessons: readonly T[]): T[] {
  return [...lessons].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title, "vi"),
  );
}

/** Students only ever see published lessons. */
export function visibleLessons<T extends Pick<Lesson, "order" | "title" | "published">>(
  lessons: readonly T[],
  audience: "student" | "admin",
): T[] {
  return sortLessons(audience === "admin" ? lessons : lessons.filter((l) => l.published === true));
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Trắc nghiệm",
  listen_choose: "Nghe và chọn",
  word_to_meaning: "Từ → nghĩa",
  meaning_to_word: "Nghĩa → từ",
  ipa_to_word: "IPA → từ",
  fill_blank: "Điền từ",
};
