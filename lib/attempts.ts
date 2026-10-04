import type { DatabaseReference } from "firebase/database";
import { statsAfterComplete, statsAfterStart } from "./attempt-model.ts";
import type { AnswerResult } from "./review.ts";
import { getStudentSession, type FirebaseClient } from "./firebase.ts";

export const ATTEMPTS_PATH = "attempts";
export const STATS_PATH = "userExerciseStats";

export type AttemptHandle = {
  attemptId: string;
  attemptNumber: number;
  startedAtClient: number;
  complete(result: AttemptResult): Promise<void>;
  abandon(result: AttemptResult): Promise<void>;
};

/** answerResults (per question: given answer, right or wrong) feed the review. */
export type AttemptResult = {
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  answerResults?: AnswerResult[];
};

type Info = { exerciseId: string; exerciseTitle: string; userName: string; totalQuestions: number };

async function serverNow(client: FirebaseClient): Promise<number> {
  const { db, dbSdk: fb } = client;
  try {
    const snapshot = await fb.get(fb.ref(db, ".info/serverTimeOffset"));
    const offset = snapshot.val();
    return Date.now() + (typeof offset === "number" ? offset : 0);
  } catch {
    return Date.now();
  }
}

/**
 * Starts a new attempt. Every start (including "Làm lại") creates a new
 * attempt node; previous attempts are never overwritten.
 *
 * attemptCount is incremented with a transaction on
 * `userExerciseStats/{uid}/{exerciseId}`, so two tabs starting at the same
 * time still get 1, 2 rather than both writing 1. The committed count is the
 * attempt's number ("Lần 3").
 *
 * Resolves to null when Firebase is not configured.
 */
export async function startAttempt(info: Info): Promise<AttemptHandle | null> {
  const session = await getStudentSession();
  if (!session) return null;
  const { client, user } = session;
  const { db, dbSdk: fb } = client;
  const uid = user.uid;
  const now = await serverNow(client);

  const statsRef = fb.ref(db, `${STATS_PATH}/${uid}/${info.exerciseId}`);
  const tx = await fb.runTransaction(statsRef, (previous: unknown) =>
    statsAfterStart(previous, info, now),
  );
  const attemptNumber = (tx.snapshot.val() as { attemptCount?: number } | null)?.attemptCount ?? 1;

  const attemptRef: DatabaseReference = fb.push(fb.ref(db, `${ATTEMPTS_PATH}/${uid}/${info.exerciseId}`));
  const startedAtClient = Date.now();
  await fb.set(attemptRef, {
    userName: info.userName,
    exerciseTitle: info.exerciseTitle,
    attemptNumber,
    startedAt: fb.serverTimestamp(),
    correctAnswers: 0,
    totalQuestions: info.totalQuestions,
    score: 0,
    durationMs: 0,
    status: "in_progress",
  });

  let finished = false;
  const finish = async (
    status: "completed" | "abandoned",
    result: AttemptResult,
  ) => {
    if (finished) return;
    finished = true;
    await fb.update(attemptRef, {
      status,
      finishedAt: fb.serverTimestamp(),
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      score: result.score,
      durationMs: Math.max(0, Date.now() - startedAtClient),
      ...(result.answerResults ? { answerResults: result.answerResults } : {}),
    });
    if (status === "completed") {
      const completedAt = await serverNow(client);
      await fb.runTransaction(statsRef, (previous: unknown) =>
        statsAfterComplete(previous, { ...info, score: result.score }, completedAt),
      );
    }
  };

  return {
    attemptId: attemptRef.key ?? "",
    attemptNumber,
    startedAtClient,
    complete: (result) => finish("completed", result),
    abandon: (result) => finish("abandoned", result),
  };
}
