"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AdminUser } from "../../lib/admin-auth";
import { Link } from "../shared/Link";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "▦", match: (p: string) => p === "/admin" },
  { href: "/admin/users", label: "Học viên", icon: "👥", match: (p: string) => p.startsWith("/admin/users") },
  { href: "/admin/exercises", label: "Bài học", icon: "📚", match: (p: string) => p.startsWith("/admin/exercises") },
  { href: "/admin/attempts", label: "Lượt làm", icon: "📝", match: (p: string) => p.startsWith("/admin/attempts") },
  { href: "/admin/import", label: "Import bài", icon: "⬆", match: (p: string) => p.startsWith("/admin/import") },
  { href: "/admin/settings", label: "Cài đặt", icon: "⚙", match: (p: string) => p.startsWith("/admin/settings") },
];

function AdminSidebar({ path, onNavigate }: { path: string; onNavigate: () => void }) {
  return (
    <nav aria-label="Quản trị">
      <ul className="admin-nav">
        {NAV.map((item) => {
          const active = item.match(path);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={active ? "is-active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <span aria-hidden="true" className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type AdminLayoutProps = {
  path: string;
  user: AdminUser;
  onSignOut: () => void;
  children: ReactNode;
};

export function AdminLayout({ path, user, onSignOut, children }: AdminLayoutProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="admin">
      <header className="admin-topbar">
        <button
          type="button"
          className="btn btn-small btn-ghost menu-btn"
          aria-expanded={open}
          aria-controls="admin-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">☰</span> Menu
        </button>
        <Link href="/admin" className="brand">
          <span className="brand-mark" aria-hidden="true">Aa</span>
          <span>Quản trị</span>
        </Link>
        <div className="header-right">
          <span className="muted small hide-sm">{user.email}</span>
          <button type="button" className="btn btn-small btn-ghost" onClick={onSignOut}>Đăng xuất</button>
        </div>
      </header>
      <div className="admin-body">
        {open && (
          <button type="button" className="drawer-backdrop" aria-label="Đóng menu" onClick={() => setOpen(false)} />
        )}
        <aside id="admin-drawer" className={`admin-sidebar ${open ? "is-open" : ""}`}>
          <AdminSidebar path={path} onNavigate={() => setOpen(false)} />
          <Link href="/" className="admin-student-link">↗ Trang học viên</Link>
        </aside>
        <main id="main" className="admin-main">{children}</main>
      </div>
    </div>
  );
}
