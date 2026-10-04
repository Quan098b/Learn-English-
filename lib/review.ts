/**
 * Answer results for a finished test, and the "Ôn câu sai" review set.
 * Pure functions — unit tested.
 */
import { isAnswerCorrect, type Question } from "./lesson-schema.ts";

export type AnswerResult = {
  questionId: string;
  /** Option id or typed text; "" when the question was not answered. */
  answer: string;
  correct: boolean;
};

export const ANSWER_MAX_LENGTH = 100;

/** One entry per question, in order. Unanswered questions count as wrong. */
export function buildAnswerResults(
  questions: readonly Question[],
  answers: readonly (string | null)[],
): AnswerResult[] {
  return questions.map((question, index) => {
    const answer = answers[index] ?? null;
    return {
      questionId: question.id,
      answer: (answer ?? "").slice(0, ANSWER_MAX_LENGTH),
      correct: answer !== null && isAnswerCorrect(question, answer),
    };
  });
}

export type WrongAnswer = { index: number; question: Question; answer: string | null };

/** Questions answered wrongly (or skipped), with what the learner gave. */
export function wrongAnswers(
  questions: readonly Question[],
  answers: readonly (string | null)[],
): WrongAnswer[] {
  return questions.flatMap((question, index) => {
    const answer = answers[index] ?? null;
    return answer !== null && isAnswerCorrect(question, answer) ? [] : [{ index, question, answer }];
  });
}

/** Builds the question list for a review run ("Ôn câu sai" / "Làm lại câu này"). */
export function reviewQuestions(questions: readonly Question[], wrong: readonly WrongAnswer[]): Question[] {
  const ids = new Set(wrong.map((w) => w.question.id));
  return questions.filter((q) => ids.has(q.id));
}

/** Parses answerResults read back from Firebase (array or numeric-key object). */
export function parseAnswerResults(raw: unknown): AnswerResult[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null
      ? Object.keys(raw).sort((a, b) => Number(a) - Number(b)).map((k) => (raw as Record<string, unknown>)[k])
      : [];
  return list.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const v = item as Record<string, unknown>;
    if (typeof v.questionId !== "string" || typeof v.correct !== "boolean") return [];
    return [{ questionId: v.questionId, answer: typeof v.answer === "string" ? v.answer : "", correct: v.correct }];
  });
}
