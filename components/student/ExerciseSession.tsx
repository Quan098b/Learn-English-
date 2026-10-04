"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSpeech } from "../../hooks/useSpeech";
import { startAttempt, type AttemptHandle, type AttemptResult } from "../../lib/attempts";
import {
  getProgressSnapshot,
  getServerProgressSnapshot,
  hasStartedStudying,
  isLessonStudied,
  subscribeProgress,
} from "../../lib/lesson-progress";
import { hasLearningContent, type Lesson, type Question } from "../../lib/lesson-schema";
import type { Activity } from "../../lib/presence-model";
import { saveResult } from "../../lib/results";
import { buildAnswerResults } from "../../lib/review";
import { computeProgress, computeScore } from "../../lib/scoring";
import { Link } from "../shared/Link";
import { ExercisePlayer } from "./ExercisePlayer";
import { LessonStepper } from "./LessonStepper";
import { ResultScreen } from "./ResultScreen";

type ExerciseSessionProps = {
  lesson: Lesson;
  userName: string | null;
  /** Reports what this tab is doing, for presence. */
  onActivity: (activity: Activity) => void;
  onExit: () => void;
  /** Admin preview: nothing is recorded, no intro screen. */
  preview?: boolean;
};

type Run = {
  /** 0 = intro screen (no attempt yet); each start/retry increments it. */
  run: number;
  index: number;
  answers: (string | null)[];
  finished: boolean;
};

/** "Ôn câu sai": a local, unscored run over a subset of questions. */
type Review = {
  questions: Question[];
  index: number;
  answers: (string | null)[];
  finished: boolean;
};

const freshRun = (lesson: Lesson, run: number): Run => ({
  run,
  index: 0,
  answers: lesson.questions.map(() => null),
  finished: false,
});

const noopSubscribe = () => () => {};

function attemptResult(lesson: Lesson, answers: (string | null)[]): AttemptResult {
  const score = computeScore(lesson.questions, answers);
  return {
    correctAnswers: score.correct,
    totalQuestions: score.total,
    score: score.percent,
    answerResults: buildAnswerResults(lesson.questions, answers),
  };
}

/**
 * The scored test ("Kiểm tra"). Every start or "Làm lại" is a new attempt
 * (attempts/{uid}/{lessonId}/{attemptId}) that also stores per-question
 * answerResults. Leaving before the end — "Thoát bài", the home link,
 * another lesson, browser back — marks it abandoned; closing the browser
 * leaves it in_progress (shown as stale to admins). Reviewing wrong answers
 * afterwards is local and never creates an attempt.
 */
export function ExerciseSession({ lesson, userName, onActivity, onExit, preview = false }: ExerciseSessionProps) {
  const [state, setState] = useState<Run>(() => freshRun(lesson, preview ? 1 : 0));
  const [review, setReview] = useState<Review | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<{ run: number; number: number; startedAt: number } | null>(null);
  const handleRef = useRef<AttemptHandle | null>(null);
  const stateRef = useRef(state);
  const speech = useSpeech(lesson.audio);
  const progressMap = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getServerProgressSnapshot);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const userNameRef = useRef(userName);
  const hasName = Boolean(userName);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // One attempt per run (run 0 is the intro screen). The 0 ms timer skips
  // React StrictMode's throw-away mount so development does not create
  // duplicate attempts.
  const { run } = state;
  useEffect(() => {
    const name = userNameRef.current;
    if (preview || !name || run === 0) return;
    let cancelled = false;
    let handle: AttemptHandle | null = null;
    const abandon = (target: AttemptHandle) =>
      target.abandon(attemptResult(lesson, stateRef.current.answers)).catch(() => undefined);

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
  const testing = run > 0 && !state.finished && !review;

  const activity = useMemo<Activity>(() => {
    if (preview || !testing) return { state: "viewing" };
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
  }, [preview, testing, state.index, lesson, currentAttempt]);

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

  const answerReview = useCallback((value: string) => {
    setReview((r) => {
      if (!r || r.finished || r.answers[r.index] !== null) return r;
      const answers = [...r.answers];
      answers[r.index] = value;
      return { ...r, answers };
    });
  }, []);

  const next = () => {
    if (state.index + 1 < lesson.questions.length) {
      setState({ ...state, index: state.index + 1 });
      return;
    }
    const finished = { ...state, finished: true };
    stateRef.current = finished;
    setState(finished);
    window.scrollTo({ top: 0 });
    if (preview) return;
    saveResult(lesson.id, computeScore(lesson.questions, state.answers));
    void handleRef.current?.complete(attemptResult(lesson, state.answers))
      .catch((error: unknown) => console.warn("[attempt]", error));
  };

  const startReview = (questions: Question[]) => {
    if (questions.length === 0) return;
    setReview({ questions, index: 0, answers: questions.map(() => null), finished: false });
    window.scrollTo({ top: 0 });
  };

  const retry = () => {
    setReview(null);
    setState(freshRun(lesson, run + 1));
  };

  const studied = isLessonStudied(lesson, progressMap[lesson.id]);
  const exitLabel = preview ? "← Đóng xem thử" : "← Thoát bài";

  // ---------- Intro: "Bắt đầu kiểm tra" ----------
  if (run === 0) {
    const needsStudy = hasLearningContent(lesson) && !studied && mounted;
    return (
      <section className="test-intro" aria-labelledby="intro-title">
        <LessonStepper lesson={lesson} current="test" />
        <h1 id="intro-title">Kiểm tra: {lesson.title}</h1>
        <ul className="intro-facts">
          <li>{lesson.questions.length} câu, đi từ dễ đến khó hơn.</li>
          <li>Phần này <strong>tính điểm</strong> và không có gợi ý — hãy tự làm nhé.</li>
          <li>Làm xong bạn sẽ xem lại từng câu sai và vì sao sai.</li>
        </ul>
        {needsStudy && (
          <p className="panel-notice">
            {hasStartedStudying(progressMap[lesson.id])
              ? "Bạn chưa học hết bài này. Nên học xong phần quy tắc, ví dụ và luyện tập trước khi kiểm tra."
              : "Bạn chưa học bài này. Nên xem quy tắc và ví dụ trước khi kiểm tra."}
          </p>
        )}
        <div className="row-actions">
          {needsStudy ? (
            <>
              <Link className="btn btn-primary" href={`/learn/${lesson.id}`}>Học bài trước</Link>
              <button type="button" className="btn btn-ghost" onClick={retry}>Vẫn làm kiểm tra</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={retry}>Bắt đầu kiểm tra</button>
              {hasLearningContent(lesson) && (
                <Link className="btn btn-ghost" href={`/learn/${lesson.id}`}>Xem lại bài học</Link>
              )}
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={onExit}>Về trang chủ</button>
        </div>
      </section>
    );
  }

  // ---------- Review of wrong answers (unscored) ----------
  if (review) {
    const reviewLesson = { ...lesson, questions: review.questions };
    if (review.finished) {
      return (
        <ResultScreen
          lesson={reviewLesson}
          answers={review.answers}
          mode="review"
          attemptNumber={null}
          onReview={startReview}
          onRetry={retry}
          onBackToResult={() => setReview(null)}
          onHome={onExit}
        />
      );
    }
    return (
      <>
        <p className="panel-notice review-banner">Ôn câu sai — phần này không tính điểm.</p>
        <ExercisePlayer
          lesson={reviewLesson}
          index={review.index}
          answer={review.answers[review.index] ?? null}
          onAnswer={answerReview}
          onNext={() =>
            setReview((r) => r && (r.index + 1 < r.questions.length ? { ...r, index: r.index + 1 } : { ...r, finished: true }))
          }
          onExit={() => setReview(null)}
          exitLabel="← Về kết quả"
          speech={speech}
        />
      </>
    );
  }

  // ---------- Result ----------
  if (state.finished) {
    return (
      <ResultScreen
        lesson={lesson}
        answers={state.answers}
        mode="test"
        attemptNumber={currentAttempt?.number ?? null}
        onReview={startReview}
        onRetry={retry}
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
      exitLabel={exitLabel}
      speech={speech}
    />
  );
}
