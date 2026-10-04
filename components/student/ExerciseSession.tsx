"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpeech } from "../../hooks/useSpeech";
import { startAttempt, type AttemptHandle } from "../../lib/attempts";
import type { Lesson } from "../../lib/lesson-schema";
import type { Activity } from "../../lib/presence-model";
import { saveResult } from "../../lib/results";
import { computeProgress, computeScore } from "../../lib/scoring";
import { ExercisePlayer } from "./ExercisePlayer";
import { ResultScreen } from "./ResultScreen";

type ExerciseSessionProps = {
  lesson: Lesson;
  userName: string | null;
  /** Reports what this tab is doing, for presence. */
  onActivity: (activity: Activity) => void;
  onExit: () => void;
  /** Admin preview: nothing is recorded. */
  preview?: boolean;
};

type RunState = {
  run: number;
  index: number;
  answers: (string | null)[];
  finished: boolean;
};

const freshRun = (lesson: Lesson, run: number): RunState => ({
  run,
  index: 0,
  answers: lesson.questions.map(() => null),
  finished: false,
});

/**
 * One exercise, possibly retried several times. Every run is a new attempt
 * (attempts/{uid}/{lessonId}/{attemptId}); leaving before the end — "Thoát
 * bài", the home link, another lesson, browser back — marks it abandoned.
 * Closing the browser leaves it in_progress (shown as stale to admins).
 */
export function ExerciseSession({ lesson, userName, onActivity, onExit, preview = false }: ExerciseSessionProps) {
  const [state, setState] = useState<RunState>(() => freshRun(lesson, 1));
  const [attemptInfo, setAttemptInfo] = useState<{ run: number; number: number; startedAt: number } | null>(null);
  const handleRef = useRef<AttemptHandle | null>(null);
  const stateRef = useRef(state);
  const speech = useSpeech(lesson.audio);

  const userNameRef = useRef(userName);
  const hasName = Boolean(userName);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // Start one attempt per run. The 0 ms timer skips React StrictMode's
  // throw-away mount so development does not create duplicate attempts.
  const { run } = state;
  useEffect(() => {
    const name = userNameRef.current;
    if (preview || !name) return;
    let cancelled = false;
    let handle: AttemptHandle | null = null;
    const timer = setTimeout(() => {
      void startAttempt({
        exerciseId: lesson.id,
        exerciseTitle: lesson.title,
        userName: name,
        totalQuestions: lesson.questions.length,
      })
        .then((created) => {
          if (!created) return;
          handle = created;
          if (cancelled) {
            void abandon(created);
            return;
          }
          handleRef.current = created;
          setAttemptInfo({ run, number: created.attemptNumber, startedAt: created.startedAtClient });
        })
        .catch((error: unknown) => console.warn("[attempt]", error));
    }, 0);

    const abandon = (target: AttemptHandle) => {
      const { answers } = stateRef.current;
      const score = computeScore(lesson.questions, answers);
      return target.abandon({ correctAnswers: score.correct, totalQuestions: score.total, score: score.percent }).catch(() => undefined);
    };

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // complete() already ran for finished runs; abandon() is then a no-op.
      if (handle && !stateRef.current.finished) void abandon(handle);
      handleRef.current = null;
    };
    // The name is read once per run (renaming mid-attempt keeps the snapshot).
  }, [run, lesson, preview, hasName]);

  const currentAttempt = attemptInfo?.run === run ? attemptInfo : null;

  const activity = useMemo<Activity>(() => {
    if (preview || state.finished) return { state: "viewing" };
    const total = lesson.questions.length;
    const current = state.index + 1;
    return {
      state: "doing",
      exerciseId: lesson.id,
      exerciseTitle: lesson.title,
      currentQuestion: current,
      totalQuestions: total,
      progress: computeProgress(current, total),
      attemptNumber: currentAttempt?.number ?? 0,
      attemptStartedAt: currentAttempt?.startedAt ?? 0,
    };
  }, [preview, state.finished, state.index, lesson, currentAttempt]);

  useEffect(() => {
    onActivity(activity);
  }, [activity, onActivity]);

  useEffect(() => () => onActivity({ state: "viewing" }), [onActivity]);

  const answer = useCallback((value: string) => {
    setState((s) => {
      if (s.finished || s.answers[s.index] !== null) return s;
      const answers = [...s.answers];
      answers[s.index] = value;
      return { ...s, answers };
    });
  }, []);

  const next = () => {
    if (state.index + 1 < lesson.questions.length) {
      setState({ ...state, index: state.index + 1 });
      return;
    }
    const score = computeScore(lesson.questions, state.answers);
    const finished = { ...state, finished: true };
    stateRef.current = finished;
    setState(finished);
    window.scrollTo({ top: 0 });
    if (preview) return;
    saveResult(lesson.id, score);
    void handleRef.current
      ?.complete({ correctAnswers: score.correct, totalQuestions: score.total, score: score.percent })
      .catch((error: unknown) => console.warn("[attempt]", error));
  };

  if (state.finished) {
    return (
      <ResultScreen
        title={lesson.title}
        score={computeScore(lesson.questions, state.answers)}
        attemptNumber={currentAttempt?.number ?? null}
        onRetry={() => setState(freshRun(lesson, state.run + 1))}
        onHome={onExit}
        homeLabel={preview ? "Đóng xem thử" : "Về trang chủ"}
      />
    );
  }

  return (
    <ExercisePlayer
      lesson={lesson}
      index={state.index}
      answer={state.answers[state.index] ?? null}
      onAnswer={answer}
      onNext={next}
      onExit={onExit}
      exitLabel={preview ? "← Đóng xem thử" : "← Thoát bài"}
      speech={speech}
    />
  );
}
