import { formatTime } from "../../lib/format";
import type { StatsTree } from "../../lib/attempt-model";
import type { ConnectionStatus } from "../../lib/presence";
import type { OnlineUser } from "../../lib/presence-model";
import { Link } from "../shared/Link";
import { ProgressBar } from "../shared/ProgressBar";

type LiveUsersProps = {
  users: OnlineUser[];
  status: ConnectionStatus;
  stats: StatsTree;
};

/** Realtime: question / progress changes appear without reloading. */
export function LiveUsers({ users, status, stats }: LiveUsersProps) {
  return (
    <section className="panel" aria-labelledby="live-title">
      <h2 id="live-title" className="panel-title">Đang online</h2>
      {status !== "online" && <p className="panel-notice">{status === "error" ? "Không đọc được presence." : "Đang kết nối…"}</p>}
      {status === "online" && users.length === 0 && <p className="panel-notice">Không có ai online.</p>}
      <ul className="live-list">
        {users.map((user) => {
          const count = user.exerciseId ? stats[user.userId]?.[user.exerciseId]?.attemptCount : undefined;
          return (
            <li key={user.userId} className="live-card">
              <p className="user-name">
                <span className="dot dot-online" aria-hidden="true" />{" "}
                <Link href={`/admin/users/${user.userId}`}>{user.name}</Link>
                {user.sessionCount > 1 && <span className="chip">{user.sessionCount} tab</span>}
              </p>
              {user.state === "doing" ? (
                <dl className="live-grid">
                  <div><dt>Đang làm</dt><dd>{user.exerciseTitle}</dd></div>
                  <div><dt>Câu</dt><dd>{user.currentQuestion} / {user.totalQuestions}</dd></div>
                  <div className="live-progress">
                    <dt>Tiến độ</dt>
                    <dd>
                      <ProgressBar size="sm" value={user.progress} label={`Tiến độ của ${user.name}`} />
                      <span>{user.progress}%</span>
                    </dd>
                  </div>
                  <div><dt>Lượt làm bài này</dt><dd>{user.attemptNumber || count || "–"}</dd></div>
                  <div><dt>Bắt đầu</dt><dd>{formatTime(user.attemptStartedAt)}</dd></div>
                </dl>
              ) : (
                <p className="muted">Đang xem trang · online từ {formatTime(user.connectedAt)}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
