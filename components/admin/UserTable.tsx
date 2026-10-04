"use client";

import { useMemo } from "react";
import { useAdminStats, useAdminUsers } from "../../hooks/useAdminData";
import { useNow } from "../../hooks/useNow";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { summarizeUser } from "../../lib/attempt-model";
import { formatPercent, formatRelative } from "../../lib/format";
import { Link } from "../shared/Link";

export function UserTable() {
  const { users } = useAdminUsers();
  const { stats, status } = useAdminStats();
  const { users: online } = useOnlineUsers("admin", null);
  const now = useNow(60_000);

  const rows = useMemo(() => {
    const ids = new Set([...Object.keys(users), ...Object.keys(stats)]);
    const onlineById = new Map(online.map((u) => [u.userId, u]));
    return [...ids]
      .map((userId) => {
        const summary = summarizeUser(stats[userId]);
        const live = onlineById.get(userId);
        const name =
          live?.name ?? users[userId]?.name ?? summary.exercises[0]?.userName ?? "?";
        return { userId, name, live, ...summary, lastSeen: Math.max(summary.lastAttemptAt ?? 0, users[userId]?.lastActiveAt ?? 0) || null };
      })
      .sort((a, b) => Number(Boolean(b.live)) - Number(Boolean(a.live)) || (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  }, [users, stats, online]);

  return (
    <>
      <h1 className="admin-title">Học viên</h1>
      <p className="muted">Hai người trùng tên vẫn là hai dòng khác nhau (phân biệt bằng userId).</p>
      {status === "connecting" && <p className="panel-notice">Đang tải…</p>}
      <div className="table-wrap" role="region" aria-label="Bảng học viên">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Tên</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Bài đang làm</th>
              <th scope="col">Tổng lượt làm</th>
              <th scope="col">Lần học cuối</th>
              <th scope="col">Điểm gần nhất</th>
              <th scope="col">Điểm cao nhất</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="muted">Chưa có học viên.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.userId}>
                <th scope="row">
                  <Link href={`/admin/users/${row.userId}`}>{row.name}</Link>
                  <span className="muted small"> · {row.userId.slice(0, 6)}</span>
                </th>
                <td>
                  {row.live ? (
                    <span className="badge badge-online"><span className="dot dot-online" aria-hidden="true" /> Online</span>
                  ) : (
                    <span className="badge">Offline</span>
                  )}
                </td>
                <td>
                  {row.live?.state === "doing"
                    ? `${row.live.exerciseTitle} (${row.live.currentQuestion}/${row.live.totalQuestions})`
                    : "–"}
                </td>
                <td>{row.totalAttempts}</td>
                <td>{formatRelative(row.lastSeen, now)}</td>
                <td>{formatPercent(row.lastScore)}</td>
                <td>{formatPercent(row.bestScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
