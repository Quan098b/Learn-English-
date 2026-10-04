"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { checkGuidedAnswer, completedSentence, revealNextHint, visibleHints } from "../../lib/guided";
import { FILL_BLANK_INSTRUCTION, type GuidedPracticeItem } from "../../lib/lesson-schema";
import { ExplanationView } from "./ExplanationView";
import { SpeechButton } from "./SpeechButton";

type Speech = { supported: boolean; enabled: boolean; speak: (text: string) => Promise<boolean> };

type GuidedPracticeProps = {
  items: GuidedPracticeItem[];
  speech: Speech;
  onComplete: () => void;
};

type Result = { answer: string; correct: boolean };

/**
 * "Luyện cùng hướng dẫn": not a test. No score, no attempt; hints open one
 * at a time; a wrong answer explains why and lets the learner try again.
 */
export function GuidedPractice({ items, speech, onComplete }: GuidedPracticeProps) {
  const [index, setIndex] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();

  const item = items[index];
  const isLast = index === items.length - 1;
  const hints = visibleHints(hintsShown, item);
  const answer = item.correctAnswer;

  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  useEffect(() => {
    if (result?.correct) nextRef.current?.focus();
  }, [result]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!typed.trim() || result) return;
    setResult({ answer: typed.trim(), ...checkGuidedAnswer(item, typed) });
  };

  const tryAgain = () => {
    setResult(null);
    setTyped("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const next = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex(index + 1);
    setHintsShown(0);
    setTyped("");
    setResult(null);
  };

  return (
    <section className="guided" aria-labelledby="guided-title">
      <div className="guided-head">
        <h2 id="guided-title">Luyện cùng hướng dẫn</h2>
        <p className="muted small">
          Câu {index + 1} / {items.length} · Phần này <strong>không tính điểm</strong>. Cứ bấm “Gợi ý” khi cần.
        </p>
      </div>

      <div className="question-card">
        <p className="question-focus" lang="en">{item.display}</p>
        <p className="question-prompt">{item.prompt ?? FILL_BLANK_INSTRUCTION}</p>

        <div className="hints" aria-live="polite">
          {hints.map((hint, i) => (
            <p key={i} className="hint-item">
              <span className="hint-badge">Gợi ý {i + 1}/{item.hints.length}</span> {hint}
            </p>
          ))}
        </div>
        {!result && hintsShown < item.hints.length && (
          <button
            type="button"
            className="btn btn-small btn-ghost hint-btn"
            onClick={() => setHintsShown((n) => revealNextHint(n, item))}
          >
            <span aria-hidden="true">💡</span> Gợi ý {hintsShown > 0 ? `(${hintsShown}/${item.hints.length})` : ""}
          </button>
        )}

        <form className="typed-answer" onSubmit={submit}>
          <label htmlFor={inputId} className="sr-only">Từ còn thiếu</label>
          <input
            key={item.id}
            id={inputId}
            ref={inputRef}
            className={`text-input ${result ? (result.correct ? "is-correct" : "is-wrong") : ""}`}
            value={result ? result.answer : typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={result !== null}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Nhập từ còn thiếu..."
            lang="en"
          />
          {!result && (
            <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>
              Kiểm tra
            </button>
          )}
        </form>

        <div aria-live="assertive">
          {result && (
            <div className={`feedback ${result.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <p className="feedback-title">
                <span aria-hidden="true">{result.correct ? "✓ " : "✗ "}</span>
                {result.correct ? "Chính xác!" : "Chưa đúng — không sao, mình cùng xem lại nhé."}
              </p>
              {!result.correct && (
                <p>
                  Bạn nhập: <strong lang="en">{result.answer}</strong> · Đáp án: <strong lang="en">{answer}</strong>
                </p>
              )}
              <ExplanationView explanation={item.explanation} wrongAnswer={result.correct ? null : result.answer} />
              <p className="complete-sentence" lang="en">
                {completedSentence(item.display, answer)}
              </p>
              <SpeechButton
                text={item.speakSentence ?? completedSentence(item.display, answer)}
                label="Nghe câu"
                {...speech}
              />
            </div>
          )}
        </div>

        {result && (
          <div className="row-actions guided-actions">
            {!result.correct && (
              <button type="button" className="btn btn-ghost" onClick={tryAgain}>Thử lại câu này</button>
            )}
            <button ref={nextRef} type="button" className="btn btn-primary" onClick={next}>
              {isLast ? "Xong phần luyện tập →" : "Câu tiếp theo →"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
