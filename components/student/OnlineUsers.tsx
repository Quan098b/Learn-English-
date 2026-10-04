import type { ConnectionStatus } from "../../lib/presence";
import type { OnlineUser } from "../../lib/presence-model";
import { ProgressBar } from "../shared/ProgressBar";

type OnlineUsersProps = {
  users: OnlineUser[];
  summary: { online: number; doing: number };
  status: ConnectionStatus;
};

function notice(status: ConnectionStatus): string | null {
  switch (status) {
    case "disabled":
      return "Chưa cấu hình Firebase nên chưa thể hiển thị ai đang học.";
    case "error":
      return "Không kết nối được tới máy chủ realtime. Hãy thử tải lại trang.";
    case "offline":
      return "Mất kết nối — đang thử kết nối lại…";
    case "connecting":
      return "Đang kết nối…";
    default:
      return null;
  }
}

/**
 * Student-facing list: only name, state, lesson title and progress
 * (no scores, no history, no ids).
 */
export function OnlineUsers({ users, summary, status }: OnlineUsersProps) {
  const live = status === "online";
  const message = notice(status);
  return (
    <section className="panel online-panel" aria-labelledby="online-title">
      <div className="panel-head">
        <h2 id="online-title">Đang học cùng bạn</h2>
        <dl className="stats">
          <div>
            <dt>Người online</dt>
            <dd>{live ? summary.online : "–"}</dd>
          </div>
          <div>
            <dt>Đang làm bài</dt>
            <dd>{live ? summary.doing : "–"}</dd>
          </div>
        </dl>
      </div>

      {message && <p className="panel-notice">{message}</p>}
      {live && users.length === 0 && <p className="panel-notice">Chưa có ai online.</p>}

      {live && users.length > 0 && (
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.userId} className="user-row">
              <span className="dot dot-online" aria-hidden="true" />
              <div className="user-body">
                <p className="user-name">
                  {user.name}
                  {user.isSelf && <span className="you-tag">bạn</span>}
                  <span className="sr-only">, đang online</span>
                </p>
                {user.state === "doing" ? (
                  <>
                    <p className="user-activity">
                      Đang làm bài <strong>“{user.exerciseTitle}”</strong>
                    </p>
                    <div className="user-progress">
                      <ProgressBar size="sm" value={user.progress} label={`Tiến độ của ${user.name}`} />
                      <span className="user-progress-text">
                        {user.currentQuestion}/{user.totalQuestions} · {user.progress}%
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="user-activity muted">Đang xem trang</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
