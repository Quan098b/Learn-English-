import { studySteps } from "../../lib/lesson-progress";
import type { Lesson } from "../../lib/lesson-schema";

export type StepId = "theory" | "vocabulary" | "examples" | "guided" | "test" | "review";

type LessonStepperProps = {
  lesson: Lesson;
  current: StepId;
  /** Study steps are clickable on the learn page. */
  onSelect?: (step: StepId) => void;
};

/**
 * "1. Học quy tắc · 2. Xem ví dụ · 3. Luyện tập · 4. Kiểm tra · 5. Ôn lỗi" —
 * only the steps this lesson has.
 */
export function LessonStepper({ lesson, current, onSelect }: LessonStepperProps) {
  const steps: { id: StepId; label: string }[] = [
    ...studySteps(lesson).map((s) => ({ id: s.id as StepId, label: s.label })),
    { id: "test", label: "Kiểm tra" },
    { id: "review", label: "Ôn lỗi" },
  ];
  const currentIndex = steps.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Các bước của bài học" className="stepper-wrap">
      <ol className="stepper">
        {steps.map((step, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
          const clickable = onSelect && step.id !== "test" && step.id !== "review";
          const content = (
            <>
              <span className="stepper-dot" aria-hidden="true">{state === "done" ? "✓" : i + 1}</span>
              <span className="stepper-label">{step.label}</span>
            </>
          );
          return (
            <li key={step.id} className={`stepper-item is-${state}`} aria-current={state === "active" ? "step" : undefined}>
              {clickable ? (
                <button type="button" className="stepper-btn" onClick={() => onSelect(step.id)}>
                  {content}
                </button>
              ) : (
                <span className="stepper-btn">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
