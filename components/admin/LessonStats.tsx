"use client";

import { useAdminLessons, useAdminStats } from "../../hooks/useAdminData";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { summarizeExercise } from "../../lib/attempt-model";
import { formatPercent, formatRelative } from "../../lib/format";
import { useNow } from "../../hooks/useNow";
import { Link } from "../shared/Link";

export function LessonStats({ lessonId }: { lessonId: string }) {
  const { lessons, status } = useAdminLessons();
  const { stats } = useAdminStats();
  const { users: online } = useOnlineUsers("admin", null);
  const now = useNow(60_000);
  const lesson = lessons.find((l) => l.id === lessonId);
  const summary = summarizeExercise(stats, lessonId);
  const doingNow = online.filter((u) => u.state === "doing" && u.exerciseId === lessonId);
  const title = lesson?.title ?? summary.rows[0]?.exerciseTitle ?? lessonId;

  return (
    <>
      <Link href="/admin/exercises" className="btn btn-small btn-ghost">← Bài học</Link>
      <h1 className="admin-title">{title}</h1>
      {!lesson && status === "online" && (
        <p className="panel-notice">Bài này không còn trong danh sách (đã xoá); lịch sử vẫn được giữ.</p>
      )}
      {lesson && (
        <div className="row-actions">
          <Link className="btn btn-small btn-ghost" href={`/admin/exercises/${lessonId}/edit`}>Sửa</Link>
          <Link className="btn btn-small btn-ghost" href={`/admin/exercises/${lessonId}/preview`}>Xem thử</Link>
        </div>
      )}
      <dl className="tiles">
        <div className="tile"><dt>Số người đã làm</dt><dd>{summary.learners}</dd></div>
        <div className="tile"><dt>Tổng lượt làm</dt><dd>{summary.attempts}</dd></div>
        <div className="tile"><dt>Điểm TB (lần gần nhất)</dt><dd>{formatPercent(summary.averageLastScore)}</dd></div>
        <div className="tile"><dt>Điểm cao nhất</dt><dd>{formatPercent(summary.bestScore)}</dd></div>
        <div className="tile"><dt>Điểm thấp nhất (lần gần nhất)</dt><dd>{formatPercent(summary.worstLastScore)}</dd></div>
        <div className="tile"><dt>Đang làm</dt><dd>{doingNow.length}</dd></div>
      </dl>

      <section className="panel" aria-labelledby="lesson-learners">
        <h2 id="lesson-learners" className="panel-title">Học viên</h2>
        {summary.rows.length === 0 && <p className="panel-notice">Chưa có ai làm bài này.</p>}
        <ul className="stat-list">
          {summary.rows.map((row) => (
            <li key={row.userId}>
              <Link href={`/admin/users/${row.userId}`}><strong>{row.userName}</strong></Link>
              <span>{row.attemptCount} lần</span>
              <span>Best {formatPercent(row.bestScore)}</span>
              <span>Last {formatPercent(row.lastScore)}</span>
              <span className="muted">{formatRelative(row.lastAttemptAt, now)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
