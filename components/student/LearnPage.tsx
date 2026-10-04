"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeech } from "../../hooks/useSpeech";
import { markProgress, studySteps } from "../../lib/lesson-progress";
import type { Lesson } from "../../lib/lesson-schema";
import { navigate } from "../../lib/router";
import { Link } from "../shared/Link";
import { ExampleCard } from "./ExampleCard";
import { GuidedPractice } from "./GuidedPractice";
import { LessonStepper, type StepId } from "./LessonStepper";
import { TheorySectionView } from "./TheorySectionView";
import { VocabularyCard } from "./VocabularyCard";

type StudyStep = ReturnType<typeof studySteps>[number];

/** The theory step is split into short screens: goals first, then one section each. */
function theoryPages(lesson: Lesson): ("goals" | number)[] {
  return [...(lesson.goals?.length ? (["goals"] as const) : []), ...(lesson.theory ?? []).map((_, i) => i)];
}

/**
 * "Học bài": rules → vocabulary → worked examples → guided practice, one
 * step at a time with ← Quay lại / Tiếp tục →, then the scored test.
 * Presence stays "viewing" here; nothing is scored.
 */
export function LearnPage({ lesson }: { lesson: Lesson }) {
  const speech = useSpeech(lesson.audio);
  const steps = studySteps(lesson);
  const [stepIndex, setStepIndex] = useState(0);
  const [page, setPage] = useState(0);
  const headingRef = useRef<HTMLDivElement>(null);
  const pages = theoryPages(lesson);
  const step: StudyStep | undefined = steps[stepIndex];

  // Move focus/scroll to the new screen so the learner starts at the top.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [stepIndex, page]);

  const finishStep = (current: StudyStep) => markProgress(lesson.id, { [current.flag]: true });

  const goToStep = (index: number) => {
    setStepIndex(index);
    setPage(0);
  };

  const next = () => {
    if (!step) return;
    if (step.id === "theory" && page < pages.length - 1) {
      setPage(page + 1);
      return;
    }
    finishStep(step);
    if (stepIndex < steps.length - 1) goToStep(stepIndex + 1);
    else navigate(`/exercise/${lesson.id}`);
  };

  const back = () => {
    if (step?.id === "theory" && page > 0) {
      setPage(page - 1);
      return;
    }
    if (stepIndex > 0) {
      const prev = steps[stepIndex - 1];
      setStepIndex(stepIndex - 1);
      setPage(prev.id === "theory" ? Math.max(0, pages.length - 1) : 0);
    }
  };

  const selectStep = (id: StepId) => {
    const index = steps.findIndex((s) => s.id === id);
    if (index >= 0) goToStep(index);
  };

  if (!step) {
    // A lesson without study content goes straight to the test.
    return (
      <div className="empty">
        <h1>{lesson.title}</h1>
        <p className="muted">Bài này chưa có phần học, bạn có thể làm bài ngay.</p>
        <Link className="btn btn-primary" href={`/exercise/${lesson.id}`}>Làm bài</Link>
      </div>
    );
  }

  let body;
  if (step.id === "theory") {
    const current = pages[page];
    body =
      current === "goals" ? (
        <article className="theory" aria-labelledby="goals-title">
          <h2 id="goals-title" className="theory-title">Bạn sẽ học gì?</h2>
          <p className="theory-p">Sau bài này bạn sẽ biết:</p>
          <ul className="goal-list">
            {lesson.goals?.map((goal, i) => (
              <li key={i}><span aria-hidden="true">✓</span> {goal}</li>
            ))}
          </ul>
        </article>
      ) : (
        <TheorySectionView section={lesson.theory![current]} speech={speech} />
      );
  } else if (step.id === "vocabulary") {
    body = (
      <>
        <h2 className="theory-title">Từ vựng</h2>
        <ul className="vocab-grid">
          {lesson.vocabulary?.map((item, i) => (
            <VocabularyCard key={`${item.word}-${i}`} item={item} {...speech} />
          ))}
        </ul>
      </>
    );
  } else if (step.id === "examples") {
    body = (
      <>
        <h2 className="theory-title">Xem ví dụ</h2>
        <p className="theory-p">Đọc từng ví dụ, bấm 🔊 để nghe, rồi xem vì sao câu được viết như vậy.</p>
        <ol className="example-list">
          {lesson.examples?.map((example, i) => (
            <ExampleCard key={example.id} example={example} index={i} speech={speech} />
          ))}
        </ol>
      </>
    );
  } else {
    body = (
      <GuidedPractice
        items={lesson.guidedPractice ?? []}
        speech={speech}
        onComplete={() => {
          finishStep(step);
          navigate(`/exercise/${lesson.id}`);
        }}
      />
    );
  }

  const isTheory = step.id === "theory";
  const atLastScreen = stepIndex === steps.length - 1 && (!isTheory || page === pages.length - 1);
  const canGoBack = stepIndex > 0 || (isTheory && page > 0);

  return (
    <section className="learn" aria-labelledby="learn-title">
      <div className="page-head">
        <Link href="/" className="btn btn-small btn-ghost">← Trang chủ</Link>
        <h1 id="learn-title">{lesson.title}</h1>
        {lesson.description && <p className="muted">{lesson.description}</p>}
      </div>
      <LessonStepper lesson={lesson} current={step.id} onSelect={selectStep} />
      {speech.enabled && !speech.supported && (
        <p className="panel-notice">Trình duyệt này không hỗ trợ phát âm tự động.</p>
      )}

      <div ref={headingRef} tabIndex={-1} className="learn-body">
        {isTheory && pages.length > 1 && (
          <p className="muted small page-count">Phần {page + 1} / {pages.length}</p>
        )}
        {body}
      </div>

      {step.id !== "guided" && (
        <div className="learn-nav">
          <button type="button" className="btn btn-ghost" onClick={back} disabled={!canGoBack}>
            ← Quay lại
          </button>
          <button type="button" className="btn btn-primary" onClick={next}>
            {atLastScreen ? "Bắt đầu kiểm tra →" : "Tiếp tục →"}
          </button>
        </div>
      )}
      {step.id === "guided" && (
        <div className="learn-nav">
          <button type="button" className="btn btn-ghost" onClick={back}>← Quay lại</button>
          <Link className="btn btn-ghost" href={`/exercise/${lesson.id}`}>Bỏ qua, làm kiểm tra</Link>
        </div>
      )}
    </section>
  );
}
