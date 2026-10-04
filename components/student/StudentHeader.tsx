import type { ConnectionStatus } from "../../lib/presence";
import { Link } from "../shared/Link";

type StudentHeaderProps = {
  name: string | null;
  onlineCount: number;
  status: ConnectionStatus;
  onRename: () => void;
  onSettings: () => void;
};

function statusLabel(status: ConnectionStatus, onlineCount: number): string {
  switch (status) {
    case "online":
      return `${onlineCount} người online`;
    case "offline":
      return "Mất kết nối";
    case "disabled":
      return "Realtime chưa bật";
    case "error":
      return "Lỗi kết nối";
    default:
      return "Đang kết nối…";
  }
}

export function StudentHeader({ name, onlineCount, status, onRename, onSettings }: StudentHeaderProps) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="English Practice — về trang chủ">
          <span className="brand-mark" aria-hidden="true">Aa</span>
          <span>English Practice</span>
        </Link>
        <div className="header-right">
          {name && (
            <span className="greeting">
              Xin chào, <strong>{name}</strong> <span aria-hidden="true">👋</span>
            </span>
          )}
          {name && (
            <button type="button" className="btn btn-small btn-ghost" onClick={onRename}>
              Đổi tên
            </button>
          )}
          <button type="button" className="btn btn-small btn-ghost" onClick={onSettings} aria-label="Cài đặt phát âm">
            <span aria-hidden="true">⚙</span>
            <span className="hide-sm">Cài đặt</span>
          </button>
          <span className={`status-pill status-${status}`}>
            <span className="dot" aria-hidden="true" />
            {statusLabel(status, onlineCount)}
          </span>
        </div>
      </div>
    </header>
  );
}
