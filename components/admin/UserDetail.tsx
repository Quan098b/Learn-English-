"use client";

import { useMemo } from "react";
import { useAdminStats, useAdminUsers } from "../../hooks/useAdminData";
import { useNow } from "../../hooks/useNow";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { useRealtimeValue } from "../../hooks/useRealtimeValue";
import { attemptDisplayStatus, flattenAttempts, summarizeUser } from "../../lib/attempt-model";
import { ATTEMPTS_PATH } from "../../lib/attempts";
import { formatPercent, formatRelative } from "../../lib/format";
import { Link } from "../shared/Link";
import { AttemptsTable, liveAttemptCheck } from "./AttemptsTable";

export function UserDetail({ userId }: { userId: string }) {
  const { users } = useAdminUsers();
  const { stats } = useAdminStats(userId);
  const { value } = useRealtimeValue("admin", `${ATTEMPTS_PATH}/${userId}`);
  const { users: online } = useOnlineUsers("admin", null);
  const now = useNow(30_000);

  const summary = summarizeUser(stats[userId]);
  const live = online.find((u) => u.userId === userId);
  const attempts = useMemo(() => {
    const isLive = liveAttemptCheck(online);
    return flattenAttempts(value, userId).map((a) => ({ ...a, display: attemptDisplayStatus(a, now, isLive(a)) }));
  }, [value, userId, online, now]);
  const name = live?.name ?? users[userId]?.name ?? attempts[0]?.userName ?? "Học viên";

  return (
    <>
      <Link href="/admin/users" className="btn btn-small btn-ghost">← Học viên</Link>
      <h1 className="admin-title">
        {name}{" "}
        {live ? (
          <span className="badge badge-online"><span className="dot dot-online" aria-hidden="true" /> Online</span>
        ) : (
          <span className="badge">Offline</span>
        )}
      </h1>
      <p className="muted small">userId: {userId}</p>
      {live?.state === "doing" && (
        <p className="panel-notice">
          Đang làm <strong>{live.exerciseTitle}</strong> — câu {live.currentQuestion}/{live.totalQuestions} ({live.progress}%)
        </p>
      )}
      <dl className="tiles">
        <div className="tile"><dt>Tổng số lượt làm</dt><dd>{summary.totalAttempts}</dd></div>
        <div className="tile"><dt>Điểm gần nhất</dt><dd>{formatPercent(summary.lastScore)}</dd></div>
        <div className="tile"><dt>Điểm cao nhất</dt><dd>{formatPercent(summary.bestScore)}</dd></div>
        <div className="tile"><dt>Lần học cuối</dt><dd className="small-dd">{formatRelative(summary.lastAttemptAt, now)}</dd></div>
      </dl>

      <section className="panel" aria-labelledby="per-lesson">
        <h2 id="per-lesson" className="panel-title">Theo bài</h2>
        {summary.exercises.length === 0 && <p className="panel-notice">Chưa làm bài nào.</p>}
        <ul className="stat-list">
          {summary.exercises.map((s) => (
            <li key={s.exerciseId}>
              <Link href={`/admin/exercises/${s.exerciseId}`}><strong>{s.exerciseTitle}</strong></Link>
              <span>{s.attemptCount} lần</span>
              <span>tốt nhất {formatPercent(s.bestScore)}</span>
              <span>gần nhất {formatPercent(s.lastScore)}</span>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="section-title">Lịch sử làm bài</h2>
      <AttemptsTable rows={attempts} showUser={false} now={now} />
    </>
  );
}
