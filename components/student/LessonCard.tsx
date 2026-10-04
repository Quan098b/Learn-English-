import { isLessonStudied, type LessonProgress } from "../../lib/lesson-progress";
import { hasLearningContent, type Lesson } from "../../lib/lesson-schema";
import type { LastResult } from "../../lib/results";
import { Link } from "../shared/Link";

type LessonCardProps = {
  lesson: Lesson;
  index: number;
  lastResult?: LastResult;
  progress?: LessonProgress;
};

/**
 * Learn first, test later: until the learner has gone through the study
 * steps, "Học bài" is the main button and "Làm bài" is secondary.
 */
export function LessonCard({ lesson, index, lastResult, progress }: LessonCardProps) {
  const words = lesson.vocabulary?.length ?? 0;
  const learnable = hasLearningContent(lesson);
  const studied = isLessonStudied(lesson, progress);
  const learnFirst = learnable && !studied;
  return (
    <li className="lesson-card">
      <div>
        <p className="lesson-kicker">Bài {index + 1}</p>
        <h3>{lesson.title}</h3>
        {lesson.description && <p className="lesson-desc">{lesson.description}</p>}
      </div>
      <div className="chips">
        <span className="chip">{lesson.level}</span>
        {lesson.theory?.length ? <span className="chip">Có giải thích</span> : null}
        {words > 0 && <span className="chip">{words} từ</span>}
        <span className="chip">{lesson.questions.length} câu</span>
        {learnable && studied && <span className="chip chip-good">Đã học</span>}
        {lastResult && (
          <span className="chip chip-good">Lần trước: {lastResult.correct}/{lastResult.total}</span>
        )}
      </div>
      <div className="card-actions">
        {learnable && (
          <Link
            className={`btn ${learnFirst ? "btn-primary" : "btn-ghost"}`}
            href={`/learn/${lesson.id}`}
            aria-label={`${studied ? "Học lại" : "Học bài"} ${lesson.title}`}
          >
            {studied ? "Học lại" : "Học bài"}
          </Link>
        )}
        <Link
          className={`btn ${learnFirst ? "btn-ghost" : "btn-primary"}`}
          href={`/exercise/${lesson.id}`}
          aria-label={`Làm bài ${lesson.title}`}
        >
          Làm bài
        </Link>
      </div>
    </li>
  );
}
