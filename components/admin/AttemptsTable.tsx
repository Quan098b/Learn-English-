"use client";

import { useId, useMemo, useState } from "react";
import { useNow } from "../../hooks/useNow";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { useRealtimeValue } from "../../hooks/useRealtimeValue";
import {
  attemptDisplayStatus,
  flattenAttempts,
  STATUS_LABELS,
  type Attempt,
  type AttemptDisplayStatus,
} from "../../lib/attempt-model";
import { ATTEMPTS_PATH } from "../../lib/attempts";
import { formatDateTime, isToday } from "../../lib/format";
import type { OnlineUser } from "../../lib/presence-model";
import { formatDuration } from "../../lib/scoring";
import { Link } from "../shared/Link";

/** An in_progress attempt is live when its user is currently doing that lesson. */
export function liveAttemptCheck(online: OnlineUser[]) {
  const doing = new Map(online.filter((u) => u.state === "doing").map((u) => [u.userId, u]));
  return (attempt: Attempt) => {
    const user = doing.get(attempt.userId);
    return Boolean(user && user.exerciseId === attempt.exerciseId && user.attemptNumber === attempt.attemptNumber);
  };
}

type Row = Attempt & { display: AttemptDisplayStatus };

export function AttemptsTable({ rows, showUser = true, now }: { rows: Row[]; showUser?: boolean; now: number }) {
  return (
    <div className="table-wrap" role="region" aria-label="Bảng lượt làm bài">
      <table className="table">
        <thead>
          <tr>
            {showUser && <th scope="col">Tên</th>}
            <th scope="col">Bài</th>
            <th scope="col">Lần</th>
            <th scope="col">Điểm</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Bắt đầu</th>
            <th scope="col">Kết thúc</th>
            <th scope="col">Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={showUser ? 8 : 7} className="muted">Không có lượt làm nào.</td></tr>
          )}
          {rows.map((a) => (
            <tr key={`${a.userId}-${a.exerciseId}-${a.attemptId}`}>
              {showUser && (
                <th scope="row"><Link href={`/admin/users/${a.userId}`}>{a.userName}</Link></th>
              )}
              <td>{a.exerciseTitle}</td>
              <td>{a.attemptNumber || "–"}</td>
              <td>
                {a.status === "completed" ? `${a.score}% · ${a.correctAnswers} đúng · ${a.totalQuestions - a.correctAnswers} sai` : a.status === "abandoned" ? `${a.correctAnswers}/${a.totalQuestions} đúng` : "–"}
              </td>
              <td><span className={`badge badge-${a.display}`}>{STATUS_LABELS[a.display]}</span></td>
              <td>{formatDateTime(a.startedAt)}</td>
              <td>{formatDateTime(a.finishedAt)}</td>
              <td>{a.finishedAt ? formatDuration(a.durationMs) : a.display === "in_progress" ? formatDuration(now - a.startedAt) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "today", label: "Hôm nay" },
  { id: "completed", label: "Completed" },
  { id: "in_progress", label: "In progress" },
  { id: "abandoned", label: "Abandoned" },
];

export function AttemptsPage() {
  const { value, status } = useRealtimeValue("admin", ATTEMPTS_PATH);
  const { users: online } = useOnlineUsers("admin", null);
  const now = useNow(30_000);
  const [filter, setFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [lessonFilter, setLessonFilter] = useState("");
  const userSelectId = useId();
  const lessonSelectId = useId();

  const all = useMemo(() => {
    const isLive = liveAttemptCheck(online);
    return flattenAttempts(value).map((a) => ({ ...a, display: attemptDisplayStatus(a, now, isLive(a)) }));
  }, [value, online, now]);

  const userOptions = useMemo(
    () => [...new Map(all.map((a) => [a.userId, a.userName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "vi")),
    [all],
  );
  const lessonOptions = useMemo(
    () => [...new Map(all.map((a) => [a.exerciseId, a.exerciseTitle])).entries()].sort((a, b) => a[1].localeCompare(b[1], "vi")),
    [all],
  );

  const rows = all.filter((a) => {
    if (userFilter && a.userId !== userFilter) return false;
    if (lessonFilter && a.exerciseId !== lessonFilter) return false;
    switch (filter) {
      case "today":
        return isToday(a.startedAt, now);
      case "completed":
        return a.status === "completed";
      case "in_progress":
        return a.display === "in_progress";
      case "abandoned":
        return a.display === "abandoned" || a.display === "stale";
      default:
        return true;
    }
  });

  return (
    <>
      <h1 className="admin-title">Lượt làm bài</h1>
      <div className="filters">
        <div className="segmented" role="group" aria-label="Lọc theo trạng thái">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? "is-active" : ""}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="field-inline">
          <label htmlFor={userSelectId}>Học viên</label>
          <select id={userSelectId} className="select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {userOptions.map(([id, name]) => (
              <option key={id} value={id}>{name} ({id.slice(0, 6)})</option>
            ))}
          </select>
        </div>
        <div className="field-inline">
          <label htmlFor={lessonSelectId}>Bài</label>
          <select id={lessonSelectId} className="select" value={lessonFilter} onChange={(e) => setLessonFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {lessonOptions.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        </div>
      </div>
      {status === "connecting" && <p className="panel-notice">Đang tải…</p>}
      <p className="muted small">{rows.length} lượt</p>
      <AttemptsTable rows={rows} now={now} />
    </>
  );
}
