"use client";

import { useAdminLessons, useAdminStats, useAdminUsers } from "../../hooks/useAdminData";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { LiveUsers } from "./LiveUsers";

export function AdminDashboard() {
  const { users: online, summary, status } = useOnlineUsers("admin", null);
  const { users } = useAdminUsers();
  const { stats } = useAdminStats();
  const { lessons } = useAdminLessons();

  const learners = new Set([...Object.keys(users), ...Object.keys(stats)]).size;
  const totalAttempts = Object.values(stats).reduce(
    (sum, perUser) => sum + Object.values(perUser).reduce((s, x) => s + x.attemptCount, 0),
    0,
  );

  const tiles = [
    { label: "Người đã học", value: learners },
    { label: "Đang online", value: summary.online },
    { label: "Đang làm bài", value: summary.doing },
    { label: "Lượt làm bài", value: totalAttempts },
    { label: "Bài học", value: lessons.length },
  ];

  return (
    <>
      <h1 className="admin-title">Tổng quan</h1>
      <dl className="tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="tile">
            <dt>{tile.label}</dt>
            <dd>{tile.value}</dd>
          </div>
        ))}
      </dl>
      <LiveUsers users={online} status={status} stats={stats} />
    </>
  );
}
