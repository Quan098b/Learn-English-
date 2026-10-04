/**
 * Per-browser study progress ("Học bài" steps), kept in localStorage.
 * It only decides which button is highlighted and whether the test page
 * suggests studying first — it never blocks the test.
 */
import { hasLearningContent, type Lesson } from "./lesson-schema.ts";

export type LessonProgress = {
  theoryViewed?: boolean;
  vocabularyViewed?: boolean;
  examplesViewed?: boolean;
  guidedCompleted?: boolean;
  updatedAt?: number;
};
export type ProgressMap = Record<string, LessonProgress>;

const KEY = "englishPractice.lessonProgress";
const EMPTY: ProgressMap = {};
const FLAGS = ["theoryViewed", "vocabularyViewed", "examplesViewed", "guidedCompleted"] as const;

export function parseProgress(raw: string | null): ProgressMap {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return EMPTY;
    const result: ProgressMap = {};
    for (const [lessonId, value] of Object.entries(data)) {
      if (typeof value !== "object" || value === null) continue;
      const v = value as Record<string, unknown>;
      const entry: LessonProgress = {};
      for (const flag of FLAGS) if (v[flag] === true) entry[flag] = true;
      if (typeof v.updatedAt === "number") entry.updatedAt = v.updatedAt;
      result[lessonId] = entry;
    }
    return result;
  } catch {
    return EMPTY;
  }
}

type StudyLesson = Pick<Lesson, "goals" | "theory" | "examples" | "guidedPractice" | "vocabulary">;

/** The study steps this lesson actually has, in order. */
export function studySteps(lesson: StudyLesson) {
  const steps: { id: "theory" | "vocabulary" | "examples" | "guided"; flag: (typeof FLAGS)[number]; label: string }[] = [];
  if (lesson.goals?.length || lesson.theory?.length) steps.push({ id: "theory", flag: "theoryViewed", label: "Học quy tắc" });
  if (lesson.vocabulary?.length) steps.push({ id: "vocabulary", flag: "vocabularyViewed", label: "Từ vựng" });
  if (lesson.examples?.length) steps.push({ id: "examples", flag: "examplesViewed", label: "Xem ví dụ" });
  if (lesson.guidedPractice?.length) steps.push({ id: "guided", flag: "guidedCompleted", label: "Luyện tập" });
  return steps;
}

/** True when every study step the lesson has has been gone through. */
export function isLessonStudied(lesson: StudyLesson, progress: LessonProgress | undefined): boolean {
  if (!hasLearningContent(lesson)) return true;
  return studySteps(lesson).every((step) => progress?.[step.flag] === true);
}

export function hasStartedStudying(progress: LessonProgress | undefined): boolean {
  return FLAGS.some((flag) => progress?.[flag] === true);
}

let cachedRaw: string | null | undefined;
let cached: ProgressMap = EMPTY;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getProgressSnapshot(): ProgressMap {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseProgress(raw);
  }
  return cached;
}

export const getServerProgressSnapshot = (): ProgressMap => EMPTY;

export function markProgress(lessonId: string, patch: Partial<Pick<LessonProgress, (typeof FLAGS)[number]>>) {
  const current = getProgressSnapshot();
  const before = current[lessonId] ?? {};
  if (Object.entries(patch).every(([k, v]) => before[k as keyof LessonProgress] === v)) return;
  const next = { ...current, [lessonId]: { ...before, ...patch, updatedAt: Date.now() } };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: keep it for this page load only.
  }
  cachedRaw = readRaw();
  cached = next;
  for (const listener of listeners) listener();
}

export function subscribeProgress(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
