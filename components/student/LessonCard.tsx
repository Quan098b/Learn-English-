import type { Lesson } from "../../lib/lesson-schema";
import type { LastResult } from "../../lib/results";
import { Link } from "../shared/Link";

type LessonCardProps = {
  lesson: Lesson;
  index: number;
  lastResult?: LastResult;
};

export function LessonCard({ lesson, index, lastResult }: LessonCardProps) {
  const words = lesson.vocabulary?.length ?? 0;
  return (
    <li className="lesson-card">
      <div>
        <p className="lesson-kicker">Bài {index + 1}</p>
        <h3>{lesson.title}</h3>
        {lesson.description && <p className="lesson-desc">{lesson.description}</p>}
      </div>
      <div className="chips">
        <span className="chip">{lesson.level}</span>
        {words > 0 && <span className="chip">{words} từ</span>}
        <span className="chip">{lesson.questions.length} câu</span>
        {lastResult && (
          <span className="chip chip-good">Lần trước: {lastResult.correct}/{lastResult.total}</span>
        )}
      </div>
      <div className="card-actions">
        {words > 0 && (
          <Link className="btn btn-ghost" href={`/learn/${lesson.id}`} aria-label={`Học từ bài ${lesson.title}`}>
            Học từ
          </Link>
        )}
        <Link className="btn btn-primary" href={`/exercise/${lesson.id}`} aria-label={`Làm bài ${lesson.title}`}>
          Làm bài
        </Link>
      </div>
    </li>
  );
}
