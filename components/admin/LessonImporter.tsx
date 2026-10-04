"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import {
  correctAnswerLabel,
  questionOptions,
  QUESTION_TYPE_LABELS,
  type Lesson,
} from "../../lib/lesson-schema";
import { LESSON_TEMPLATE_FILE_NAME, LESSON_TEMPLATE_JSON } from "../../lib/lesson-template";
import { isLessonFileName, parseLessonFile, type ValidationResult } from "../../lib/lesson-validator";
import { lessonExists, saveLesson } from "../../lib/lessons";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { Link } from "../shared/Link";
import { IssueList } from "./IssueList";

const MAX_FILE_BYTES = 1024 * 1024;

function audioLabel(lesson: Lesson): string {
  if (lesson.audio?.enabled === false) return "Tắt";
  const lang = lesson.audio?.language;
  if (lang === "en-US") return "English US";
  if (lang === "en-GB") return "English UK";
  return lang ? lang : "Theo cài đặt học viên (US/UK)";
}

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Import flow: choose/drop file → parse + validate → preview → Import.
 * Nothing is written before the admin presses "Import bài"; an existing id
 * needs two confirmations before it is overwritten.
 */
export function LessonImporter() {
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<"idle" | "exists" | "confirm-overwrite">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [imported, setImported] = useState<Lesson | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const reset = () => {
    setFileName("");
    setResult(null);
    setShowAll(false);
    setStep("idle");
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (file: File) => {
    reset();
    setImported(null);
    setFileName(file.name);
    if (!isLessonFileName(file.name)) {
      setResult({ ok: false, warnings: [], errors: [{ where: file.name, message: "File không phải .json / .lesson.json.", fix: "Chọn file có đuôi .lesson.json." }] });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setResult({ ok: false, warnings: [], errors: [{ where: file.name, message: "File lớn hơn 1 MB.", fix: "Chia bài thành nhiều file nhỏ hơn." }] });
      return;
    }
    setResult(parseLessonFile(await file.text()));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const write = async (lesson: Lesson) => {
    setBusy(true);
    try {
      await saveLesson(lesson);
      setImported(lesson);
      reset();
    } catch (error) {
      setMessage(`Lỗi khi lưu: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const startImport = async () => {
    if (!result?.ok) return;
    setBusy(true);
    setMessage("");
    try {
      if (await lessonExists(result.lesson.id)) {
        setStep("exists");
        return;
      }
    } catch (error) {
      setMessage(`Không kiểm tra được bài trùng: ${error instanceof Error ? error.message : String(error)}`);
      return;
    } finally {
      setBusy(false);
    }
    await write(result.lesson);
  };

  const lesson = result?.ok ? result.lesson : null;
  const previewQuestions = lesson ? (showAll ? lesson.questions : lesson.questions.slice(0, 3)) : [];

  return (
    <>
      <h1 className="admin-title">Import bài học</h1>
      <p className="muted">
        File JSON UTF-8, đuôi <code>.lesson.json</code>, theo schemaVersion 1. Xem hướng dẫn trong <code>docs/LESSON_FORMAT.md</code>.
      </p>
      <div className="row-actions">
        <button type="button" className="btn btn-ghost" onClick={() => downloadText(LESSON_TEMPLATE_FILE_NAME, LESSON_TEMPLATE_JSON)}>
          ⬇ Tải file mẫu
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            void navigator.clipboard
              .writeText(LESSON_TEMPLATE_JSON)
              .then(() => setMessage("Đã copy mẫu JSON."))
              .catch(() => setMessage("Trình duyệt chặn copy — hãy dùng Tải file mẫu."))
          }
        >
          ⧉ Copy mẫu
        </button>
      </div>

      {imported && (
        <div className="issues issues-ok" role="status">
          <p className="issues-title">✅ Đã import “{imported.title}”</p>
          <p>
            {imported.published ? "Bài đã xuất hiện ở trang học viên." : "Bài đang ẩn (published: false) — bật Hiện để học viên thấy."}{" "}
            <Link href={`/admin/exercises/${imported.id}/preview`}>Xem thử</Link> ·{" "}
            <Link href="/admin/exercises">Danh sách bài</Link>
          </p>
        </div>
      )}

      <div
        className={`dropzone ${dragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="dropzone-title">Kéo file bài học vào đây</p>
        <p className="muted">hoặc</p>
        <label htmlFor={inputId} className="btn btn-primary">Chọn file</label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".json,.lesson.json,application/json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        {fileName && <p className="small">File: {fileName}</p>}
      </div>

      {message && <p className="panel-notice" role="status">{message}</p>}

      {result && !result.ok && (
        <IssueList title="❌ Không thể import" issues={result.errors} />
      )}
      {result && <IssueList title="⚠ Lưu ý" tone="warning" issues={result.warnings} />}

      {lesson && (
        <section className="panel" aria-labelledby="preview-title">
          <p className="issues-title ok">✅ File hợp lệ</p>
          <h2 id="preview-title" className="panel-title">{lesson.title}</h2>
          <dl className="summary-grid">
            <div><dt>Mã bài</dt><dd>{lesson.id}</dd></div>
            <div><dt>Level</dt><dd>{lesson.level}</dd></div>
            <div><dt>Lý thuyết</dt><dd>{lesson.theory?.length ? `Có (${lesson.theory.length} phần)` : "Không"}</dd></div>
            <div><dt>Ví dụ</dt><dd>{lesson.examples?.length ?? 0}</dd></div>
            <div><dt>Luyện có hướng dẫn</dt><dd>{lesson.guidedPractice?.length ?? 0}</dd></div>
            <div><dt>Từ vựng</dt><dd>{lesson.vocabulary?.length ?? 0}</dd></div>
            <div><dt>Câu kiểm tra</dt><dd>{lesson.questions.length}</dd></div>
            <div><dt>Audio</dt><dd>{audioLabel(lesson)}</dd></div>
            <div><dt>Hiển thị</dt><dd>{lesson.published ? "Published" : "Ẩn"}</dd></div>
          </dl>
          <ol className="preview-list">
            {previewQuestions.map((q) => {
              const options = questionOptions(q);
              return (
                <li key={q.id}>
                  <p className="small muted">{q.id} · {QUESTION_TYPE_LABELS[q.type]}</p>
                  {q.display && <p className="preview-display">{q.display}</p>}
                  <p>{q.prompt}</p>
                  {options && (
                    <ul className="preview-options">
                      {options.map((o) => (
                        <li key={o.id} className={o.id === q.correctAnswer ? "is-answer" : ""}>
                          {o.id}. {o.text} {o.id === q.correctAnswer && <span>✓ đáp án</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!options && <p className="small">Đáp án: <strong>{correctAnswerLabel(q)}</strong></p>}
                  {q.speak && <p className="small muted">🔊 {q.speak}</p>}
                </li>
              );
            })}
          </ol>
          {lesson.questions.length > 3 && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Thu gọn" : `Preview tất cả ${lesson.questions.length} câu`}
            </button>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={reset}>Hủy</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void startImport()}>
              {busy ? "Đang xử lý…" : "Import bài"}
            </button>
          </div>
        </section>
      )}

      {lesson && step === "exists" && (
        <ConfirmDialog
          title="Bài đã tồn tại"
          confirmLabel="Ghi đè"
          danger
          onCancel={() => setStep("idle")}
          onConfirm={() => setStep("confirm-overwrite")}
        >
          <p>Bài “{lesson.id}” đã tồn tại.</p>
        </ConfirmDialog>
      )}
      {lesson && step === "confirm-overwrite" && (
        <ConfirmDialog
          title="Xác nhận ghi đè"
          confirmLabel="Ghi đè bài"
          requireText={lesson.id}
          danger
          busy={busy}
          onCancel={() => setStep("idle")}
          onConfirm={() => void write(lesson)}
        >
          <p>Nội dung cũ của bài “{lesson.id}” sẽ bị thay thế. Lịch sử làm bài vẫn được giữ.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
