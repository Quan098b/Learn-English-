"use client";

import { useCallback } from "react";
import { useAdminLessons } from "../../hooks/useAdminData";
import { navigate } from "../../lib/router";
import { Link } from "../shared/Link";
import { ExerciseSession } from "../student/ExerciseSession";

const noop = () => {};

/** Plays a lesson (even unpublished) without recording attempts or presence. */
export function LessonPreview({ lessonId }: { lessonId: string }) {
  const { lessons, status } = useAdminLessons();
  const lesson = lessons.find((l) => l.id === lessonId);
  const close = useCallback(() => navigate("/admin/exercises"), []);

  if (!lesson) {
    return status === "online" ? (
      <p className="panel-notice">Không tìm thấy bài “{lessonId}”. <Link href="/admin/exercises">← Bài học</Link></p>
    ) : (
      <p className="panel-notice">Đang tải…</p>
    );
  }
  return (
    <>
      <p className="panel-notice">Chế độ xem thử — không lưu lượt làm.</p>
      <ExerciseSession key={lesson.id} lesson={lesson} userName={null} onActivity={noop} onExit={close} preview />
    </>
  );
}
