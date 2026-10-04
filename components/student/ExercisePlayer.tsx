"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  correctAnswerLabel,
  isAnswerCorrect,
  answerText,
  FILL_BLANK_INSTRUCTION,
  fillBlankAnswer,
  speakRevealsAnswer,
  questionOptions,
  type Lesson,
} from "../../lib/lesson-schema";
import { completedSentence } from "../../lib/guided";
import { computeProgress } from "../../lib/scoring";
import { ProgressBar } from "../shared/ProgressBar";
import { AnswerOption } from "./AnswerOption";
import { ExplanationView } from "./ExplanationView";
import { SpeechButton } from "./SpeechButton";

export type Speech = {
  supported: boolean;
  enabled: boolean;
  autoPlay: boolean;
  speak: (text: string) => Promise<boolean>;
};

type ExercisePlayerProps = {
  lesson: Lesson;
  index: number;
  /** Answer given for the current question (option id or typed text), or null. */
  answer: string | null;
  onAnswer: (value: string) => void;
  onNext: () => void;
  onExit: () => void;
  exitLabel?: string;
  speech: Speech;
};

export function ExercisePlayer({
  lesson,
  index,
  answer,
  onAnswer,
  onNext,
  onExit,
  exitLabel = "← Thoát bài",
  speech,
}: ExercisePlayerProps) {
  const question = lesson.questions[index];
  const total = lesson.questions.length;
  const current = index + 1;
  const progress = computeProgress(current, total);
  const answered = answer !== null;
  const correct = answered && isAnswerCorrect(question, answer);
  const isLast = current === total;
  const options = questionOptions(question);
  const canSpeakNow = !speakRevealsAnswer(question) || answered;
  const isFill = question.type === "fill_blank";
  // fill_blank: the sentence with "___" (display, or a legacy prompt that holds it);
  // the instruction above it is fixed so old "Chọn từ đúng…" prompts never show.
  const sentence = isFill
    ? question.display ?? (question.prompt.includes("___") ? question.prompt : null)
    : question.type === "listen_choose" ? null : question.display ?? null;
  const heading = isFill ? FILL_BLANK_INSTRUCTION : question.prompt;
  const fullSentence =
    answered && isFill && sentence?.includes("___") ? completedSentence(sentence, fillBlankAnswer(question)) : null;

  const nextRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  // New question: focus the answer box for fill_blank, otherwise the question
  // (keyboard users keep their place); optionally speak.
  const { autoPlay, supported, enabled, speak } = speech;
  useEffect(() => {
    const q = lesson.questions[index];
    if (q.type === "fill_blank") inputRef.current?.focus();
    else headingRef.current?.focus();
    if (autoPlay && supported && enabled && q.speak && !speakRevealsAnswer(q)) {
      void speak(q.speak);
    }
  }, [index, lesson, autoPlay, supported, enabled, speak]);

  // Shortcuts: 1–9 or the option letter picks an answer.
  useEffect(() => {
    if (answered || !options) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = event.key.toUpperCase();
      const byNumber = Number.parseInt(key, 10) - 1;
      const option = Number.isNaN(byNumber)
        ? options.find((o) => o.id.toUpperCase() === key)
        : options[byNumber];
      if (option) {
        event.preventDefault();
        onAnswer(option.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answered, options, onAnswer]);

  const submitTyped = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typed.trim()) onAnswer(typed.trim());
  };

  return (
    <section className="player" aria-labelledby="question-heading">
      <div className="player-top">
        <button type="button" className="btn btn-small btn-ghost" onClick={onExit}>
          {exitLabel}
        </button>
        <p className="player-title">{lesson.title}</p>
      </div>

      <div className="player-progress">
        <p className="player-count">
          <span>Câu <strong>{current}</strong> / {total}</span>
          <span className="player-percent">{progress}%</span>
        </p>
        <ProgressBar value={progress} label={`Tiến độ bài ${lesson.title}`} />
      </div>

      <div className="question-card">
        {sentence && <p className="question-focus" lang="en">{sentence}</p>}
        {question.type === "listen_choose" && question.speak && (
          <div className="listen-box">
            <SpeechButton
              text={question.speak}
              label="Nghe lại"
              size="lg"
              supported={speech.supported}
              speak={speech.speak}
            />
            {!speech.supported && (
              <p className="panel-notice">Trình duyệt không hỗ trợ phát âm — hãy thử Chrome, Edge hoặc Safari.</p>
            )}
          </div>
        )}
        <h2 id="question-heading" ref={headingRef} tabIndex={-1} className="question-prompt">
          {heading}
        </h2>

        {question.type !== "listen_choose" && (question.speak || question.speakSentence) && canSpeakNow && (
          <div className="speech-row">
            {question.speak && (
              <SpeechButton text={question.speak} supported={speech.supported} enabled={speech.enabled} speak={speech.speak} />
            )}
            {question.speakSentence && (
              <SpeechButton
                text={question.speakSentence}
                label="Nghe câu"
                supported={speech.supported}
                enabled={speech.enabled}
                speak={speech.speak}
              />
            )}
          </div>
        )}

        {options ? (
          <div className="options" role="group" aria-label="Các đáp án">
            {options.map((option) => (
              <AnswerOption
                key={`${question.id}-${option.id}`}
                option={option}
                answered={answered}
                isAnswer={option.id === question.correctAnswer}
                isChosen={option.id === answer}
                onSelect={onAnswer}
              />
            ))}
          </div>
        ) : (
          <form className="typed-answer" onSubmit={submitTyped}>
            <label htmlFor={inputId} className="sr-only">Câu trả lời của bạn</label>
            <input
              key={question.id}
              id={inputId}
              ref={inputRef}
              className={`text-input ${answered ? (correct ? "is-correct" : "is-wrong") : ""}`}
              value={answered ? answer : typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={answered}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Nhập từ còn thiếu..."
              lang="en"
            />
            {!answered && (
              <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>
                Kiểm tra
              </button>
            )}
          </form>
        )}

        <div className="feedback-area" aria-live="assertive">
          {answered && (
            <div className={`feedback ${correct ? "feedback-correct" : "feedback-wrong"}`}>
              <p className="feedback-title">
                <span aria-hidden="true">{correct ? "✓ " : "✗ "}</span>
                {correct ? "Chính xác!" : "Chưa đúng"}
              </p>
              {!correct && (
                <p>
                  Đáp án đúng: <strong>{correctAnswerLabel(question)}</strong>
                </p>
              )}
              {fullSentence && <p className="complete-sentence" lang="en">{fullSentence}</p>}
              <div className="feedback-explain">
                <ExplanationView explanation={question.explanation} wrongAnswer={correct ? null : answerText(question, answer)} />
              </div>
            </div>
          )}
        </div>

        {answered ? (
          <button
            ref={nextRef}
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              setTyped("");
              onNext();
            }}
          >
            {isLast ? "Xem kết quả" : "Câu tiếp theo →"}
          </button>
        ) : (
          options && <p className="hint">Mẹo: bấm phím 1–{options.length} hoặc chữ cái đáp án để chọn nhanh.</p>
        )}
      </div>
    </section>
  );
}
