"use client";

import { useState } from "react";
import { useAdminLessons } from "../../hooks/useAdminData";
import { adminSignOut } from "../../lib/admin-auth";
import { defaultLessons } from "../../lib/default-lessons";
import { saveLesson } from "../../lib/lessons";

export function AdminSettings() {
  const { lessons, status } = useAdminLessons();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const missing = defaultLessons.filter((d) => !lessons.some((l) => l.id === d.id));

  const seed = async () => {
    setBusy(true);
    setMessage("");
    try {
      for (const lesson of missing) await saveLesson(lesson);
      setMessage(`Đã nạp ${missing.length} bài mặc định.`);
    } catch (error) {
      setMessage(`Lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="admin-title">Cài đặt</h1>
      <section className="panel" aria-labelledby="seed-title">
        <h2 id="seed-title" className="panel-title">Bài mặc định</h2>
        <p className="muted">
          4 bài khởi đầu (Đại từ nhân xưng, Từ vựng cơ bản, Phiên âm IPA, Điền từ) nằm trong
          <code> data/default-lessons/</code>. Nút này chỉ thêm các bài còn thiếu, không ghi đè bài đã có.
        </p>
        <button type="button" className="btn btn-primary" disabled={busy || status !== "online" || missing.length === 0} onClick={() => void seed()}>
          {missing.length === 0 ? "Đã có đủ bài mặc định" : `Nạp ${missing.length} bài mặc định`}
        </button>
        {message && <p className="panel-notice" role="status">{message}</p>}
      </section>
      <section className="panel" aria-labelledby="account-title">
        <h2 id="account-title" className="panel-title">Tài khoản</h2>
        <p className="muted">
          Mật khẩu admin do Firebase Authentication quản lý. Đổi mật khẩu trong Firebase Console › Authentication › Users.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => void adminSignOut()}>Đăng xuất</button>
      </section>
    </>
  );
}
