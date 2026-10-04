"use client";

import { useSpeech } from "../../hooks/useSpeech";
import type { Lesson } from "../../lib/lesson-schema";
import { Link } from "../shared/Link";
import { VocabularyCard } from "./VocabularyCard";

/** "Học từ": vocabulary cards before the test. Presence stays "viewing". */
export function LearnPage({ lesson }: { lesson: Lesson }) {
  const { supported, enabled, speak } = useSpeech(lesson.audio);
  const words = lesson.vocabulary ?? [];
  return (
    <section aria-labelledby="learn-title" className="learn">
      <div className="page-head">
        <Link href="/" className="btn btn-small btn-ghost">← Trang chủ</Link>
        <h1 id="learn-title">{lesson.title}</h1>
        <p className="muted">
          {lesson.level} · {words.length} từ · {lesson.questions.length} câu
        </p>
        {enabled && !supported && (
          <p className="panel-notice">Trình duyệt này không hỗ trợ phát âm tự động.</p>
        )}
      </div>
      {words.length === 0 ? (
        <p className="panel-notice">Bài này chưa có danh sách từ vựng.</p>
      ) : (
        <ul className="vocab-grid">
          {words.map((item, index) => (
            <VocabularyCard key={`${item.word}-${index}`} item={item} supported={supported} enabled={enabled} speak={speak} />
          ))}
        </ul>
      )}
      <div className="learn-cta">
        <Link className="btn btn-primary" href={`/exercise/${lesson.id}`}>Làm bài kiểm tra →</Link>
      </div>
    </section>
  );
}
