/**
 * Guided practice ("Luyện cùng hướng dẫn") logic. Never scored, never
 * recorded as an attempt — pure functions, unit tested.
 */
import {
  findWhyNot,
  matchesTypedAnswer,
  type GuidedPracticeItem,
} from "./lesson-schema.ts";

/** Each press of "Gợi ý" opens exactly one more hint. */
export function revealNextHint(shown: number, item: Pick<GuidedPracticeItem, "hints">): number {
  return Math.min(shown + 1, item.hints.length);
}

export function visibleHints(shown: number, item: Pick<GuidedPracticeItem, "hints">): string[] {
  return item.hints.slice(0, Math.max(0, Math.min(shown, item.hints.length)));
}

export function checkGuidedAnswer(item: GuidedPracticeItem, answer: string) {
  const correct = matchesTypedAnswer(answer, [item.correctAnswer, ...(item.acceptedAnswers ?? [])]);
  return { correct, whyNot: correct ? null : findWhyNot(item.explanation, answer) };
}

/** The sentence with the blank filled in ("Lan is a girl. She is my friend."). */
export function completedSentence(display: string, answer: string): string {
  return display.replace(/_{3,}/, answer);
}
