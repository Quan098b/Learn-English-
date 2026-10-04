"use client";

import { useState } from "react";
import { useAdminLessons } from "../../hooks/useAdminData";
import type { Lesson } from "../../lib/lesson-schema";
import { deleteLesson, reorderLessons, setLessonPublished } from "../../lib/lessons";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { Link } from "../shared/Link";

export function LessonsTable() {
  const { stored, lessons, status } = useAdminLessons();
  const [toDelete, setToDelete] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const broken = stored.filter((s) => !s.ok);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(done);
    } catch (error) {
      setMessage(`Lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, delta: number) => {
    const ids = lessons.map((l) => l.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => reorderLessons(ids), "Đã đổi thứ tự.");
  };

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-title">Bài học</h1>
        <div className="row-actions">
          <Link href="/admin/import" className="btn btn-ghost">Import bài</Link>
          <Link href="/admin/exercises/new" className="btn btn-primary">+ Thêm bài</Link>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{message}</p>
      {message && <p className="panel-notice">{message}</p>}
      {status === "connecting" && <p className="panel-notice">Đang tải…</p>}
      {status === "online" && lessons.length === 0 && (
        <p className="panel-notice">
          Chưa có bài nào. Vào <Link href="/admin/settings">Cài đặt</Link> để nạp 4 bài mặc định, hoặc{" "}
          <Link href="/admin/import">import file</Link>.
        </p>
      )}

      <ol className="lesson-admin-list">
        {lessons.map((lesson, index) => (
          <li key={lesson.id} className="lesson-admin-item">
            <div className="lesson-admin-main">
              <p className="lesson-kicker">Bài {index + 1} · {lesson.id}</p>
              <h2>
                <Link href={`/admin/exercises/${lesson.id}`}>{lesson.title}</Link>
              </h2>
              <div className="chips">
                <span className={`badge ${lesson.published ? "badge-completed" : ""}`}>
                  {lesson.published ? "Published" : "Ẩn"}
                </span>
                <span className="chip">{lesson.level}</span>
                <span className="chip">{lesson.questions.length} câu</span>
                <span className="chip">{lesson.vocabulary?.length ?? 0} từ</span>
              </div>
            </div>
            <div className="row-actions">
              <button type="button" className="btn btn-small btn-ghost" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Đưa ${lesson.title} lên`}>↑</button>
              <button type="button" className="btn btn-small btn-ghost" disabled={busy || index === lessons.length - 1} onClick={() => move(index, 1)} aria-label={`Đưa ${lesson.title} xuống`}>↓</button>
              <Link className="btn btn-small btn-ghost" href={`/admin/exercises/${lesson.id}/edit`}>Sửa</Link>
              <Link className="btn btn-small btn-ghost" href={`/admin/exercises/${lesson.id}/preview`}>Xem thử</Link>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => setLessonPublished(lesson.id, !lesson.published),
                    lesson.published ? `Đã ẩn "${lesson.title}".` : `Đã công khai "${lesson.title}".`,
                  )
                }
              >
                {lesson.published ? "Ẩn" : "Hiện"}
              </button>
              <button type="button" className="btn btn-small btn-danger-ghost" disabled={busy} onClick={() => setToDelete(lesson)}>
                Xóa
              </button>
            </div>
          </li>
        ))}
      </ol>

      {broken.length > 0 && (
        <section className="panel" aria-labelledby="broken-title">
          <h2 id="broken-title" className="panel-title">Bài lỗi dữ liệu ({broken.length})</h2>
          <p className="muted small">Các bài này không hiển thị cho học viên. Import lại file đúng để sửa.</p>
          <ul>
            {broken.map((b) => (
              <li key={b.id}>
                <strong>{b.title}</strong> ({b.id}): {b.ok ? "" : b.errors[0]?.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Xóa bài học"
          confirmLabel="Xóa bài"
          requireText="DELETE"
          danger
          busy={busy}
          onCancel={() => setToDelete(null)}
          onConfirm={() =>
            void run(() => deleteLesson(toDelete.id), `Đã xóa "${toDelete.title}".`).then(() => setToDelete(null))
          }
        >
          <p>
            Bạn có chắc muốn xóa bài: <strong>“{toDelete.title}”</strong>?
          </p>
          <p className="muted small">Lịch sử làm bài và thống kê vẫn được giữ lại (kèm tên bài tại thời điểm làm).</p>
        </ConfirmDialog>
      )}
    </>
  );
}
