"use client";

import { useEffect, useRef } from "react";
import { useSpeech } from "../../hooks/useSpeech";
import { completedSentence } from "../../lib/guided";
import {
  answerText,
  correctAnswerLabel,
  fillBlankAnswer,
  questionHeadline,
  type Lesson,
  type Question,
} from "../../lib/lesson-schema";
import { wrongAnswers } from "../../lib/review";
import { computeScore } from "../../lib/scoring";
import { ExplanationView } from "./ExplanationView";
import { LessonStepper } from "./LessonStepper";
import { SpeechButton } from "./SpeechButton";

type ResultScreenProps = {
  lesson: Lesson;
  answers: (string | null)[];
  /** "test" = scored attempt result; "review" = result of an "Ôn câu sai" run. */
  mode: "test" | "review";
  attemptNumber: number | null;
  onReview: (questions: Question[]) => void;
  onRetry: () => void;
  onBackToResult?: () => void;
  onHome: () => void;
  homeLabel?: string;
};

function encouragement(percent: number): string {
  if (percent === 100) return "Tuyệt vời, không sai câu nào!";
  if (percent >= 80) return "Rất tốt! Xem lại vài câu sai bên dưới là nhớ ngay.";
  if (percent >= 50) return "Khá lắm! Đọc giải thích các câu sai rồi ôn lại nhé.";
  return "Không sao cả — đọc kỹ phần giải thích bên dưới rồi ôn lại từng câu.";
}

export function ResultScreen({
  lesson,
  answers,
  mode,
  attemptNumber,
  onReview,
  onRetry,
  onBackToResult,
  onHome,
  homeLabel = "Về trang chủ",
}: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const speech = useSpeech(lesson.audio);
  const score = computeScore(lesson.questions, answers);
  const wrong = wrongAnswers(lesson.questions, answers);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="result-page" aria-labelledby="result-heading">
      {mode === "test" && <LessonStepper lesson={lesson} current="review" />}
      <div className="result">
        <h2 id="result-heading" ref={headingRef} tabIndex={-1}>
          {mode === "test" ? "Hoàn thành!" : "Ôn xong!"} <span aria-hidden="true">🎉</span>
        </h2>
        <p className="result-exercise">
          {lesson.title}
          {mode === "test" && attemptNumber ? ` · Lần ${attemptNumber}` : ""}
          {mode === "review" ? " · Ôn câu sai (không tính điểm)" : ""}
        </p>
        <p className="result-score">
          <strong>{score.correct} / {score.total}</strong> câu đúng
        </p>
        {mode === "test" && <p className="result-percent">Điểm: {score.percent}%</p>}
        <p className="result-note">{encouragement(score.percent)}</p>
        <div className="result-actions">
          {wrong.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => onReview(wrong.map((w) => w.question))}>
              Ôn câu sai ({wrong.length})
            </button>
          )}
          {mode === "review" && onBackToResult && (
            <button type="button" className="btn btn-ghost" onClick={onBackToResult}>Về kết quả bài kiểm tra</button>
          )}
          <button type="button" className={`btn ${wrong.length ? "btn-ghost" : "btn-primary"}`} onClick={onRetry}>
            Làm lại cả bài
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>{homeLabel}</button>
        </div>
      </div>

      {wrong.length > 0 && (
        <section className="mistakes" aria-labelledby="mistakes-title">
          <h3 id="mistakes-title" className="section-title">Xem lại câu sai</h3>
          <ol className="mistake-list">
            {wrong.map(({ index, question, answer }) => {
              const given = answerText(question, answer);
              const full =
                question.type === "fill_blank" && question.display?.includes("___")
                  ? completedSentence(question.display, fillBlankAnswer(question))
                  : null;
              return (
                <li key={question.id} className="mistake-card">
                  <p className="lesson-kicker">Câu {index + 1}</p>
                  <p className="mistake-question" lang="en">{questionHeadline(question)}</p>
                  {question.display && <p className="muted small">{question.type === "fill_blank" ? "Điền từ còn thiếu" : question.prompt}</p>}
                  <dl className="mistake-answers">
                    <div className="is-wrong">
                      <dt>Bạn trả lời</dt>
                      <dd lang="en">{given ? <><span aria-hidden="true">✗ </span>{given}</> : "(chưa trả lời)"}</dd>
                    </div>
                    <div className="is-correct">
                      <dt>Đáp án</dt>
                      <dd lang="en"><span aria-hidden="true">✓ </span>{correctAnswerLabel(question)}</dd>
                    </div>
                  </dl>
                  {full && (
                    <div className="row-actions">
                      <p className="complete-sentence" lang="en">{full}</p>
                      <SpeechButton text={question.speakSentence ?? full} label="Nghe câu" {...speech} />
                    </div>
                  )}
                  <ExplanationView explanation={question.explanation} wrongAnswer={given || null} />
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => onReview([question])}>
                    Làm lại câu này
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </section>
  );
}
