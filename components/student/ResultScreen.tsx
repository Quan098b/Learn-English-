"use client";

import { useEffect, useRef } from "react";
import type { ScoreSummary } from "../../lib/scoring";

type ResultScreenProps = {
  title: string;
  score: ScoreSummary;
  attemptNumber: number | null;
  onRetry: () => void;
  onHome: () => void;
  homeLabel?: string;
};

function encouragement(percent: number): string {
  if (percent === 100) return "Tuyệt vời, không sai câu nào!";
  if (percent >= 80) return "Rất tốt! Chỉ còn chút xíu nữa thôi.";
  if (percent >= 50) return "Khá lắm! Làm lại một lần nữa để nhớ lâu hơn nhé.";
  return "Không sao cả, luyện thêm vài lần là nhớ ngay.";
}

export function ResultScreen({ title, score, attemptNumber, onRetry, onHome, homeLabel = "Về trang chủ" }: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="result" aria-labelledby="result-heading">
      <h2 id="result-heading" ref={headingRef} tabIndex={-1}>
        Hoàn thành! <span aria-hidden="true">🎉</span>
      </h2>
      <p className="result-exercise">
        {title}
        {attemptNumber ? ` · Lần ${attemptNumber}` : ""}
      </p>
      <p className="result-score">
        <strong>{score.correct} / {score.total}</strong> câu đúng
      </p>
      <p className="result-percent">Điểm: {score.percent}%</p>
      <p className="result-note">{encouragement(score.percent)}</p>
      <div className="result-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>Làm lại</button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>{homeLabel}</button>
      </div>
    </section>
  );
}
