import { findWhyNot, type Explanation } from "../../lib/lesson-schema";

type ExplanationViewProps = {
  explanation?: Explanation;
  /** The learner's (wrong) answer, to show the matching "why not" note. */
  wrongAnswer?: string | null;
  /** Label shown for the learner's answer (e.g. "B. họ"); defaults to wrongAnswer. */
  wrongAnswerLabel?: string;
};

/**
 * Plain-text explanations (older lessons) render as one paragraph.
 * Structured ones show the summary, the reasoning steps, and — when the
 * learner was wrong — why their answer does not fit.
 */
export function ExplanationView({ explanation, wrongAnswer, wrongAnswerLabel }: ExplanationViewProps) {
  if (!explanation) return null;
  if (typeof explanation === "string") {
    return <p className="explain-summary">{explanation}</p>;
  }
  const whyNot = findWhyNot(explanation, wrongAnswer ?? null);
  return (
    <div className="explain">
      <p className="explain-summary">{explanation.summary}</p>
      {explanation.steps && explanation.steps.length > 0 && (
        <div>
          <p className="explain-label">Tại sao?</p>
          <ol className="explain-steps">
            {explanation.steps.map((step, i) => (
              <li key={i}>
                <span className="step-badge" aria-hidden="true">Bước {i + 1}</span> {step}
              </li>
            ))}
          </ol>
        </div>
      )}
      {whyNot && (
        <div className="explain-whynot">
          <p className="explain-label">
            Vì sao không phải “{wrongAnswerLabel ?? wrongAnswer}”?
          </p>
          <p>{whyNot}</p>
        </div>
      )}
    </div>
  );
}
