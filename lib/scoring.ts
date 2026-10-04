import { isAnswerCorrect, type Question } from "./lesson-schema.ts";

export type ScoreSummary = {
  correct: number;
  total: number;
  /** 0–100, rounded. */
  percent: number;
};

/** `answers[i]` is the answer given for question i (option id or typed text), or null. */
export function computeScore(
  questions: readonly Question[],
  answers: readonly (string | null)[],
): ScoreSummary {
  const total = questions.length;
  const correct = questions.reduce((sum, question, index) => {
    const answer = answers[index];
    return sum + (answer != null && isAnswerCorrect(question, answer) ? 1 : 0);
  }, 0);
  return { correct, total, percent: percentOf(correct, total) };
}

export function percentOf(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((Math.min(Math.max(part, 0), total) / total) * 100);
}

/** Progress for "Câu {current} / {total}" (current is 1-based): 4/10 → 40. */
export function computeProgress(current: number, total: number): number {
  return percentOf(current, total);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "–";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} giây`;
  if (minutes < 60) return `${minutes} phút ${seconds} giây`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}
