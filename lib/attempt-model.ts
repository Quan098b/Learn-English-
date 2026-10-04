import { parseAnswerResults, type AnswerResult } from "./review.ts";

/**
 * Pure attempt / statistics helpers (no Firebase), shared by the student
 * player and the admin pages.
 *
 *   attempts/{userId}/{exerciseId}/{attemptId}  = Attempt fields
 *   userExerciseStats/{userId}/{exerciseId}     = UserExerciseStats
 */

export type AttemptStatus = "in_progress" | "completed" | "abandoned";
/** What admins see: in_progress attempts nobody is working on any more are "stale". */
export type AttemptDisplayStatus = AttemptStatus | "stale";

export type Attempt = {
  attemptId: string;
  userId: string;
  exerciseId: string;
  attemptNumber: number;
  userName: string;
  /** Snapshot of the lesson title when the attempt started (kept after deletion). */
  exerciseTitle: string;
  startedAt: number;
  finishedAt: number | null;
  correctAnswers: number;
  totalQuestions: number;
  /** 0–100. */
  score: number;
  durationMs: number;
  status: AttemptStatus;
  /** Per-question results (attempts made before this field existed have none). */
  answerResults: AnswerResult[];
};

export type UserExerciseStats = {
  userName: string;
  exerciseTitle: string;
  attemptCount: number;
  completedCount: number;
  lastScore: number | null;
  bestScore: number | null;
  lastAttemptAt: number;
};

/** userId → exerciseId → stats */
export type StatsTree = Record<string, Record<string, UserExerciseStats>>;

/** An in_progress attempt older than this with no live session is shown as stale. */
export const STALE_ATTEMPT_MS = 15 * 60_000;

const STATUSES: AttemptStatus[] = ["in_progress", "completed", "abandoned"];

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Transaction body run when an attempt starts: attemptCount += 1. */
export function statsAfterStart(
  previous: unknown,
  info: { userName: string; exerciseTitle: string },
  now: number,
): UserExerciseStats {
  const prev = parseStats(previous);
  return {
    userName: info.userName,
    exerciseTitle: info.exerciseTitle,
    attemptCount: (prev?.attemptCount ?? 0) + 1,
    completedCount: prev?.completedCount ?? 0,
    lastScore: prev?.lastScore ?? null,
    bestScore: prev?.bestScore ?? null,
    lastAttemptAt: now,
  };
}

/** Transaction body run when an attempt is completed. */
export function statsAfterComplete(
  previous: unknown,
  info: { userName: string; exerciseTitle: string; score: number },
  now: number,
): UserExerciseStats {
  const prev = parseStats(previous);
  const attemptCount = Math.max(prev?.attemptCount ?? 0, (prev?.completedCount ?? 0) + 1);
  return {
    userName: info.userName,
    exerciseTitle: info.exerciseTitle,
    attemptCount,
    completedCount: (prev?.completedCount ?? 0) + 1,
    lastScore: info.score,
    bestScore: Math.max(prev?.bestScore ?? 0, info.score),
    lastAttemptAt: now,
  };
}

export function parseStats(raw: unknown): UserExerciseStats | null {
  if (!isObj(raw)) return null;
  const attemptCount = num(raw.attemptCount, -1);
  if (attemptCount < 0) return null;
  return {
    userName: str(raw.userName),
    exerciseTitle: str(raw.exerciseTitle),
    attemptCount,
    completedCount: num(raw.completedCount),
    lastScore: typeof raw.lastScore === "number" ? raw.lastScore : null,
    bestScore: typeof raw.bestScore === "number" ? raw.bestScore : null,
    lastAttemptAt: num(raw.lastAttemptAt),
  };
}

export function parseStatsTree(raw: unknown): StatsTree {
  const tree: StatsTree = {};
  if (!isObj(raw)) return tree;
  for (const [userId, perUser] of Object.entries(raw)) {
    if (!isObj(perUser)) continue;
    for (const [exerciseId, value] of Object.entries(perUser)) {
      const stats = parseStats(value);
      if (stats) (tree[userId] ??= {})[exerciseId] = stats;
    }
  }
  return tree;
}

export function parseAttempt(
  userId: string,
  exerciseId: string,
  attemptId: string,
  raw: unknown,
): Attempt | null {
  if (!isObj(raw)) return null;
  const status = STATUSES.includes(raw.status as AttemptStatus) ? (raw.status as AttemptStatus) : null;
  const startedAt = num(raw.startedAt, -1);
  if (!status || startedAt < 0) return null;
  return {
    attemptId,
    userId,
    exerciseId,
    attemptNumber: num(raw.attemptNumber),
    userName: str(raw.userName, "?"),
    exerciseTitle: str(raw.exerciseTitle, exerciseId),
    startedAt,
    finishedAt: typeof raw.finishedAt === "number" ? raw.finishedAt : null,
    correctAnswers: num(raw.correctAnswers),
    totalQuestions: num(raw.totalQuestions),
    score: num(raw.score),
    durationMs: num(raw.durationMs),
    status,
    answerResults: parseAnswerResults(raw.answerResults),
  };
}

/** Flattens `attempts` (or `attempts/{userId}` when `userId` is given), newest first. */
export function flattenAttempts(raw: unknown, userId?: string): Attempt[] {
  const result: Attempt[] = [];
  if (!isObj(raw)) return result;
  const users: [string, unknown][] = userId ? [[userId, raw]] : Object.entries(raw);
  for (const [uid, perUser] of users) {
    if (!isObj(perUser)) continue;
    for (const [exerciseId, perExercise] of Object.entries(perUser)) {
      if (!isObj(perExercise)) continue;
      for (const [attemptId, value] of Object.entries(perExercise)) {
        const attempt = parseAttempt(uid, exerciseId, attemptId, value);
        if (attempt) result.push(attempt);
      }
    }
  }
  return result.sort((a, b) => b.startedAt - a.startedAt);
}

export function attemptDisplayStatus(
  attempt: Pick<Attempt, "status" | "startedAt">,
  now: number,
  isLive: boolean,
): AttemptDisplayStatus {
  if (attempt.status !== "in_progress") return attempt.status;
  if (isLive) return "in_progress";
  return now - attempt.startedAt > STALE_ATTEMPT_MS ? "stale" : "in_progress";
}

export const STATUS_LABELS: Record<AttemptDisplayStatus, string> = {
  in_progress: "Đang làm",
  completed: "Hoàn thành",
  abandoned: "Bỏ dở",
  stale: "Bỏ dở (mất kết nối)",
};

/** Per-exercise aggregate across users, for /admin/exercises/{id}. */
export function summarizeExercise(tree: StatsTree, exerciseId: string) {
  const rows = Object.entries(tree)
    .flatMap(([userId, perUser]) => (perUser[exerciseId] ? [{ userId, ...perUser[exerciseId] }] : []))
    .sort((a, b) => b.lastAttemptAt - a.lastAttemptAt);
  const scored = rows.filter((r) => r.bestScore !== null);
  const lastScores = rows.flatMap((r) => (r.lastScore === null ? [] : [r.lastScore]));
  return {
    learners: rows.length,
    attempts: rows.reduce((sum, r) => sum + r.attemptCount, 0),
    completed: rows.reduce((sum, r) => sum + r.completedCount, 0),
    averageLastScore: lastScores.length
      ? Math.round(lastScores.reduce((a, b) => a + b, 0) / lastScores.length)
      : null,
    bestScore: scored.length ? Math.max(...scored.map((r) => r.bestScore ?? 0)) : null,
    worstLastScore: lastScores.length ? Math.min(...lastScores) : null,
    rows,
  };
}

/** Per-user totals for the learners table. */
export function summarizeUser(perUser: Record<string, UserExerciseStats> | undefined) {
  const list = Object.entries(perUser ?? {}).map(([exerciseId, s]) => ({ exerciseId, ...s }));
  const latest = list.reduce<(typeof list)[number] | null>(
    (acc, s) => (!acc || s.lastAttemptAt > acc.lastAttemptAt ? s : acc),
    null,
  );
  const best = list.flatMap((s) => (s.bestScore === null ? [] : [s.bestScore]));
  return {
    totalAttempts: list.reduce((sum, s) => sum + s.attemptCount, 0),
    lastAttemptAt: latest?.lastAttemptAt ?? null,
    lastScore: latest?.lastScore ?? null,
    bestScore: best.length ? Math.max(...best) : null,
    exercises: list.sort((a, b) => b.lastAttemptAt - a.lastAttemptAt),
  };
}
