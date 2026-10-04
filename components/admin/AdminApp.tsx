"use client";

import { useEffect, useState } from "react";
import { usePath } from "../../hooks/usePath";
import { adminSignOut, watchAdminAuth, type AdminAuthState } from "../../lib/admin-auth";
import type { Route } from "../../lib/router";
import { Link } from "../shared/Link";
import { AdminDashboard } from "./AdminDashboard";
import { AdminLayout } from "./AdminLayout";
import { AdminLogin } from "./AdminLogin";
import { AdminSettings } from "./AdminSettings";
import { AttemptsPage } from "./AttemptsTable";
import { LessonEditorPage } from "./LessonEditor";
import { LessonImporter } from "./LessonImporter";
import { LessonPreview } from "./LessonPreview";
import { LessonStats } from "./LessonStats";
import { LessonsTable } from "./LessonsTable";
import { UserDetail } from "./UserDetail";
import { UserTable } from "./UserTable";

type AdminRoute = Extract<Route, { name: `admin${string}` }>;

function AdminPage({ route }: { route: AdminRoute }) {
  switch (route.name) {
    case "admin-dashboard":
      return <AdminDashboard />;
    case "admin-users":
      return <UserTable />;
    case "admin-user":
      return <UserDetail userId={route.userId} />;
    case "admin-exercises":
      return <LessonsTable />;
    case "admin-exercise-new":
      return <LessonEditorPage lessonId={null} />;
    case "admin-exercise":
      return <LessonStats lessonId={route.lessonId} />;
    case "admin-exercise-edit":
      return <LessonEditorPage lessonId={route.lessonId} />;
    case "admin-exercise-preview":
      return <LessonPreview lessonId={route.lessonId} />;
    case "admin-attempts":
      return <AttemptsPage />;
    case "admin-import":
      return <LessonImporter />;
    case "admin-settings":
      return <AdminSettings />;
  }
}

/** Nothing below the login screen subscribes to data until the admin check passes. */
export function AdminApp({ route }: { route: AdminRoute }) {
  const [auth, setAuth] = useState<AdminAuthState>({ status: "loading" });
  const path = usePath("/admin");

  useEffect(() => watchAdminAuth(setAuth), []);

  if (auth.status === "loading") {
    return <main className="login-page"><p className="panel-notice">Đang kiểm tra đăng nhập…</p></main>;
  }
  if (auth.status === "disabled") {
    return (
      <main className="login-page">
        <div className="login-card">
          <h1>Chưa cấu hình Firebase</h1>
          <p className="muted">Điền các biến NEXT_PUBLIC_FIREBASE_* rồi build lại để dùng trang quản trị.</p>
          <Link href="/" className="btn btn-ghost">← Về trang học</Link>
        </div>
      </main>
    );
  }
  if (auth.status === "signed-out") return <AdminLogin />;
  if (auth.status === "not-admin") {
    return (
      <main className="login-page">
        <div className="login-card">
          <h1>Không có quyền quản trị</h1>
          <p className="muted">
            Tài khoản {auth.user.email} đã đăng nhập nhưng chưa được cấp quyền admin
            (thiếu <code>admins/{auth.user.uid}</code> = true trong Realtime Database).
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void adminSignOut()}>Đăng xuất</button>
        </div>
      </main>
    );
  }

  return (
    <AdminLayout path={path} user={auth.user} onSignOut={() => void adminSignOut()}>
      <AdminPage route={route} />
    </AdminLayout>
  );
}
