"use client";

import { useId, useState } from "react";
import { useAdminLessons } from "../../hooks/useAdminData";
import {
  LESSON_LEVELS,
  LESSON_SCHEMA_VERSION,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Lesson,
  type Question,
  type QuestionOption,
  type QuestionType,
  type VocabularyItem,
} from "../../lib/lesson-schema";
import { parseLessonFile, validateLesson, type ValidationIssue } from "../../lib/lesson-validator";
import { lessonExists, saveLesson } from "../../lib/lessons";
import { navigate } from "../../lib/router";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { Link } from "../shared/Link";
import { IssueList } from "./IssueList";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Tab = "info" | "theory" | "examples" | "guided" | "vocabulary" | "questions" | "json";

const TABS: { id: Tab; label: string; count?: (l: Lesson) => number }[] = [
  { id: "info", label: "Thông tin" },
  { id: "theory", label: "Lý thuyết", count: (l) => (l.goals?.length ? 1 : 0) + (l.theory?.length ?? 0) },
  { id: "examples", label: "Ví dụ", count: (l) => l.examples?.length ?? 0 },
  { id: "guided", label: "Luyện tập", count: (l) => l.guidedPractice?.length ?? 0 },
  { id: "vocabulary", label: "Từ vựng", count: (l) => l.vocabulary?.length ?? 0 },
  { id: "questions", label: "Câu hỏi", count: (l) => l.questions.length },
  { id: "json", label: "JSON" },
];

type ContentPart = "theory" | "examples" | "guided";

const PART_INFO: Record<ContentPart, { keys: (keyof Lesson)[]; title: string; help: string }> = {
  theory: {
    keys: ["goals", "theory"],
    title: "Lý thuyết",
    help: 'Object có "goals" (danh sách “Bạn sẽ học gì”) và "theory" (các phần: id, title, body[], items[], table, tip). Xem docs/LESSON_FORMAT.md.',
  },
  examples: {
    keys: ["examples"],
    title: "Ví dụ",
    help: 'Object có "examples": [{ id, context?, sentence, meaning?, steps[]?, breakdown[]? }].',
  },
  guided: {
    keys: ["guidedPractice"],
    title: "Luyện có hướng dẫn",
    help: 'Object có "guidedPractice": [{ id, display (có ___), correctAnswer, acceptedAnswers?, hints[], explanation? }].',
  },
};

/** Edits one learning-content part as JSON; changes are validated with the whole lesson. */
function ContentJsonEditor({ part, draft, onApply }: { part: ContentPart; draft: Lesson; onApply: (lesson: Lesson) => void }) {
  const info = PART_INFO[part];
  const initialText = JSON.stringify(Object.fromEntries(info.keys.map((k) => [k, draft[k] ?? []])), null, 2);
  const [text, setText] = useState(initialText);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [applied, setApplied] = useState("");
  const textId = useId();

  const apply = () => {
    setApplied("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      setIssues([{ where: info.title, message: `JSON không hợp lệ: ${error instanceof Error ? error.message : String(error)}`, fix: "Kiểm tra dấu phẩy, ngoặc kép, ngoặc { } [ ]." }]);
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setIssues([{ where: info.title, message: "Phải là một object { ... }.", fix: info.help }]);
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const key of info.keys) {
      const value = (parsed as Record<string, unknown>)[key];
      patch[key] = Array.isArray(value) && value.length === 0 ? undefined : value;
    }
    const result = validateLesson({ ...draft, ...patch });
    if (!result.ok) {
      setIssues(result.errors);
      return;
    }
    setIssues([]);
    onApply(result.lesson);
    setApplied("Đã áp dụng. Nhớ bấm “Lưu bài”.");
  };

  return (
    <section className="panel" aria-labelledby={`${textId}-title`}>
      <h2 id={`${textId}-title`} className="panel-title">{info.title}</h2>
      <p className="muted small">{info.help}</p>
      <IssueList title="❌ Chưa áp dụng được" issues={issues} />
      <label htmlFor={textId} className="sr-only">{info.title} (JSON)</label>
      <textarea id={textId} className="code-input" rows={22} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="row-actions">
        <button type="button" className="btn btn-primary" onClick={apply}>Áp dụng</button>
        <button type="button" className="btn btn-ghost" onClick={() => setText(initialText)}>Hoàn tác</button>
        {applied && <span className="small" role="status">{applied}</span>}
      </div>
    </section>
  );
}

function newQuestion(index: number): Question {
  return {
    id: `q${index + 1}`,
    type: "multiple_choice",
    prompt: "",
    options: LETTERS.slice(0, 4).map((id) => ({ id, text: "" })),
    correctAnswer: "A",
  };
}

function emptyLesson(order: number): Lesson {
  return {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id: "",
    order,
    title: "",
    description: "",
    level: "A1",
    published: false,
    audio: { enabled: true, mode: "tts", rate: 0.85 },
    vocabulary: [],
    questions: [newQuestion(0)],
  };
}

/** Field-by-field editor; the result always goes through validateLesson before saving. */
function LessonForm({ initial, isNew }: { initial: Lesson; isNew: boolean }) {
  const [draft, setDraft] = useState<Lesson>(initial);
  const [tab, setTab] = useState<Tab>("info");
  const mode = tab === "json" ? "json" : "form";
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState<Lesson | null>(null);
  const uid = useId();

  const set = <K extends keyof Lesson>(key: K, value: Lesson[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setQuestion = (index: number, patch: Partial<Question>) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) => (i === index ? ({ ...q, ...patch } as Question) : q)),
    }));
  const setVocab = (index: number, patch: Partial<VocabularyItem>) =>
    setDraft((d) => ({
      ...d,
      vocabulary: (d.vocabulary ?? []).map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));

  const changeType = (index: number, type: QuestionType) => {
    const q = draft.questions[index];
    if (type === "fill_blank") {
      // Typed answer only: keep the text of the previously correct option, drop options.
      const answer = q.type === "fill_blank" ? q.correctAnswer : q.options.find((o) => o.id === q.correctAnswer)?.text ?? "";
      setQuestion(index, { type, options: undefined, correctAnswer: answer } as Partial<Question>);
    } else {
      const options = q.type !== "fill_blank" ? q.options : LETTERS.slice(0, 4).map((id) => ({ id, text: "" }));
      const correct = options.some((o) => o.id === q.correctAnswer) ? q.correctAnswer : options[0].id;
      setQuestion(index, { type, options, correctAnswer: correct, acceptedAnswers: undefined } as Partial<Question>);
    }
  };

  const setOptions = (index: number, options: QuestionOption[]) => setQuestion(index, { options } as Partial<Question>);

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    setErrors([]);
    if (next === "json") {
      setJson(JSON.stringify(draft, null, 2));
      setTab("json");
      return;
    }
    if (tab !== "json") {
      setTab(next);
      return;
    }
    const result = parseLessonFile(json);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setDraft(result.lesson);
    setTab(next);
  };

  const persist = async (lesson: Lesson) => {
    setSaving(true);
    try {
      await saveLesson(lesson);
      setMessage(`Đã lưu "${lesson.title}".`);
      if (isNew || lesson.id !== initial.id) navigate(`/admin/exercises/${lesson.id}/edit`, { replace: true });
    } catch (error) {
      setMessage(`Lỗi khi lưu: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setMessage("");
    const result = mode === "json" ? parseLessonFile(json) : validateLesson(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const lesson = result.lesson;
    if ((isNew || lesson.id !== initial.id) && (await lessonExists(lesson.id).catch(() => false))) {
      setConfirmOverwrite(lesson);
      return;
    }
    await persist(lesson);
  };

  const vocabulary = draft.vocabulary ?? [];

  return (
    <>
      <div className="segmented editor-tabs" role="tablist" aria-label="Phần của bài">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "is-active" : ""}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
            {t.count ? <span className="tab-count">{t.count(draft)}</span> : null}
          </button>
        ))}
      </div>

      <IssueList title="❌ Chưa thể lưu" issues={errors} />

      {mode === "json" ? (
        <div className="field">
          <label htmlFor={`${uid}-json`}>Nội dung bài (schemaVersion 1)</label>
          <textarea id={`${uid}-json`} className="code-input" rows={24} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
        </div>
      ) : (
        <>
          {tab === "info" && (
          <section className="panel form-grid" aria-label="Thông tin bài">
            <div className="field">
              <label htmlFor={`${uid}-id`}>Mã bài (id)</label>
              <input id={`${uid}-id`} className="text-input" value={draft.id} disabled={!isNew} onChange={(e) => set("id", e.target.value)} placeholder="vd: pronouns-02" />
              <p className="muted small">Chỉ a-z, 0-9, - và _. Không đổi được sau khi tạo.</p>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-title`}>Tiêu đề</label>
              <input id={`${uid}-title`} className="text-input" value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="field span-2">
              <label htmlFor={`${uid}-desc`}>Mô tả</label>
              <input id={`${uid}-desc`} className="text-input" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-level`}>Level</label>
              <select id={`${uid}-level`} className="select" value={draft.level} onChange={(e) => set("level", e.target.value as Lesson["level"])}>
                {LESSON_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-order`}>Thứ tự</label>
              <input id={`${uid}-order`} type="number" min={0} className="text-input" value={draft.order} onChange={(e) => set("order", Number(e.target.value))} />
            </div>
            <label className="switch">
              <input type="checkbox" checked={draft.published} onChange={(e) => set("published", e.target.checked)} />
              <span>Công khai cho học viên (published)</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.audio?.enabled !== false}
                onChange={(e) => set("audio", { mode: "tts", ...draft.audio, enabled: e.target.checked })}
              />
              <span>Bật phát âm</span>
            </label>
            <div className="field">
              <label htmlFor={`${uid}-lang`}>Giọng đọc</label>
              <select
                id={`${uid}-lang`}
                className="select"
                value={draft.audio?.language ?? ""}
                onChange={(e) => set("audio", { enabled: true, mode: "tts", ...draft.audio, language: e.target.value || undefined })}
              >
                <option value="">Theo cài đặt học viên</option>
                <option value="en-US">en-US</option>
                <option value="en-GB">en-GB</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-rate`}>Tốc độ đọc</label>
              <input
                id={`${uid}-rate`}
                type="number"
                step={0.05}
                min={0.5}
                max={1.5}
                className="text-input"
                value={draft.audio?.rate ?? 0.85}
                onChange={(e) => set("audio", { enabled: true, mode: "tts", ...draft.audio, rate: Number(e.target.value) })}
              />
            </div>
          </section>
          )}

          {tab === "vocabulary" && (
          <section className="panel" aria-labelledby={`${uid}-vocab`}>
            <h2 id={`${uid}-vocab`} className="panel-title">Từ vựng ({vocabulary.length})</h2>
            {vocabulary.map((v, i) => (
              <div key={i} className="vocab-row">
                <input aria-label={`Từ ${i + 1}`} className="text-input" placeholder="word" value={v.word} onChange={(e) => setVocab(i, { word: e.target.value })} />
                <input aria-label={`IPA từ ${i + 1}`} className="text-input" placeholder="/ipa/" value={v.ipa ?? ""} onChange={(e) => setVocab(i, { ipa: e.target.value || undefined })} />
                <input aria-label={`Nghĩa từ ${i + 1}`} className="text-input" placeholder="nghĩa" value={v.meaning} onChange={(e) => setVocab(i, { meaning: e.target.value })} />
                <button type="button" className="btn btn-small btn-danger-ghost" aria-label={`Xóa từ ${i + 1}`} onClick={() => set("vocabulary", vocabulary.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-small btn-ghost" onClick={() => set("vocabulary", [...vocabulary, { word: "", meaning: "" }])}>+ Thêm từ</button>
          </section>
          )}

          {tab === "questions" && (
          <>
          <h2 className="section-title">Câu hỏi ({draft.questions.length})</h2>
          <ol className="question-editor-list">
            {draft.questions.map((q, i) => {
              const typed = q.type === "fill_blank";
              const options = q.type === "fill_blank" ? null : q.options;
              return (
                <li key={i} className="panel question-editor">
                  <div className="question-editor-head">
                    <strong>Câu {i + 1}</strong>
                    <div className="row-actions">
                      <button type="button" className="btn btn-small btn-ghost" disabled={i === 0} aria-label={`Đưa câu ${i + 1} lên`}
                        onClick={() => setDraft((d) => { const qs = [...d.questions]; [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; return { ...d, questions: qs }; })}>↑</button>
                      <button type="button" className="btn btn-small btn-ghost" disabled={i === draft.questions.length - 1} aria-label={`Đưa câu ${i + 1} xuống`}
                        onClick={() => setDraft((d) => { const qs = [...d.questions]; [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; return { ...d, questions: qs }; })}>↓</button>
                      <button type="button" className="btn btn-small btn-danger-ghost" aria-label={`Xóa câu ${i + 1}`}
                        onClick={() => set("questions", draft.questions.filter((_, j) => j !== i))}>Xóa câu</button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`${uid}-q${i}-id`}>id</label>
                      <input id={`${uid}-q${i}-id`} className="text-input" value={q.id} onChange={(e) => setQuestion(i, { id: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`${uid}-q${i}-type`}>Loại</label>
                      <select id={`${uid}-q${i}-type`} className="select" value={q.type} onChange={(e) => changeType(i, e.target.value as QuestionType)}>
                        {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]} ({t})</option>)}
                      </select>
                    </div>
                    <div className="field span-2">
                      <label htmlFor={`${uid}-q${i}-prompt`}>{typed ? "Câu (hướng dẫn)" : "Câu hỏi (prompt)"}</label>
                      <input id={`${uid}-q${i}-prompt`} className="text-input" value={q.prompt} onChange={(e) => setQuestion(i, { prompt: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`${uid}-q${i}-display`}>{typed ? "Câu có chỗ trống (dùng ___)" : "Chữ hiển thị lớn (display)"}</label>
                      <input id={`${uid}-q${i}-display`} className="text-input" value={q.display ?? ""} onChange={(e) => setQuestion(i, { display: e.target.value || undefined })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`${uid}-q${i}-speak`}>Phát âm từ (speak)</label>
                      <input id={`${uid}-q${i}-speak`} className="text-input" value={q.speak ?? ""} onChange={(e) => setQuestion(i, { speak: e.target.value || undefined })} />
                    </div>
                    <div className="field span-2">
                      <label htmlFor={`${uid}-q${i}-sentence`}>Phát âm câu (speakSentence)</label>
                      <input id={`${uid}-q${i}-sentence`} className="text-input" value={q.speakSentence ?? ""} onChange={(e) => setQuestion(i, { speakSentence: e.target.value || undefined })} />
                    </div>
                  </div>

                  {typed ? (
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor={`${uid}-q${i}-answer`}>Đáp án đúng</label>
                        <input id={`${uid}-q${i}-answer`} className="text-input" value={q.correctAnswer} onChange={(e) => setQuestion(i, { correctAnswer: e.target.value })} />
                      </div>
                      <div className="field">
                        <label htmlFor={`${uid}-q${i}-accepted`}>Đáp án chấp nhận thêm (cách nhau dấu phẩy)</label>
                        <input
                          id={`${uid}-q${i}-accepted`}
                          className="text-input"
                          value={("acceptedAnswers" in q && q.acceptedAnswers?.join(", ")) || ""}
                          onChange={(e) => {
                            const list = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                            setQuestion(i, { acceptedAnswers: list.length ? list : undefined } as Partial<Question>);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    options && (
                      <fieldset className="options-editor">
                        <legend>Lựa chọn — chọn ◉ ở đáp án đúng</legend>
                        {options.map((o, oi) => (
                          <div key={oi} className="option-row">
                            <input
                              type="radio"
                              name={`${uid}-q${i}-correct`}
                              checked={q.correctAnswer === o.id}
                              onChange={() => setQuestion(i, { correctAnswer: o.id })}
                              aria-label={`Đáp án đúng là ${o.id}`}
                            />
                            <span className="option-letter">{o.id}</span>
                            <input
                              className="text-input"
                              aria-label={`Lựa chọn ${o.id}`}
                              value={o.text}
                              onChange={(e) => setOptions(i, options.map((x, xi) => (xi === oi ? { ...x, text: e.target.value } : x)))}
                            />
                            <button
                              type="button"
                              className="btn btn-small btn-danger-ghost"
                              aria-label={`Xóa lựa chọn ${o.id}`}
                              disabled={options.length <= 2}
                              onClick={() => setOptions(i, options.filter((_, xi) => xi !== oi).map((x, xi) => ({ ...x, id: LETTERS[xi] })))}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-small btn-ghost"
                          disabled={options.length >= LETTERS.length}
                          onClick={() => setOptions(i, [...options, { id: LETTERS[options.length], text: "" }])}
                        >
                          + Thêm lựa chọn
                        </button>
                      </fieldset>
                    )
                  )}

                  <div className="field">
                    <label htmlFor={`${uid}-q${i}-explain`}>Giải thích (explanation)</label>
                    {typeof q.explanation === "object" ? (
                      <p id={`${uid}-q${i}-explain`} className="muted small">
                        Giải thích có cấu trúc: “{q.explanation.summary}” — sửa các bước / whyNot trong tab JSON.
                      </p>
                    ) : (
                      <input id={`${uid}-q${i}-explain`} className="text-input" value={q.explanation ?? ""} onChange={(e) => setQuestion(i, { explanation: e.target.value || undefined })} />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" className="btn btn-ghost" onClick={() => set("questions", [...draft.questions, newQuestion(draft.questions.length)])}>
            + Thêm câu hỏi
          </button>
          </>
          )}
          {(tab === "theory" || tab === "examples" || tab === "guided") && (
            <ContentJsonEditor
              key={tab}
              part={tab}
              draft={draft}
              onApply={(lesson) => setDraft(lesson)}
            />
          )}
        </>
      )}

      <div className="sticky-actions">
        {message && <p className="small" role="status">{message}</p>}
        <Link href="/admin/exercises" className="btn btn-ghost">Đóng</Link>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu bài"}
        </button>
      </div>

      {confirmOverwrite && (
        <ConfirmDialog
          title="Bài đã tồn tại"
          confirmLabel="Ghi đè"
          danger
          busy={saving}
          onCancel={() => setConfirmOverwrite(null)}
          onConfirm={() => {
            const lesson = confirmOverwrite;
            setConfirmOverwrite(null);
            void persist(lesson);
          }}
        >
          <p>Bài “{confirmOverwrite.id}” đã tồn tại. Ghi đè bằng nội dung mới?</p>
        </ConfirmDialog>
      )}
    </>
  );
}

export function LessonEditorPage({ lessonId }: { lessonId: string | null }) {
  const { lessons, status } = useAdminLessons();
  const existing = lessonId ? lessons.find((l) => l.id === lessonId) : undefined;

  let body;
  if (!lessonId) {
    body = status === "connecting" ? <p className="panel-notice">Đang tải…</p> : (
      <LessonForm key="new" initial={emptyLesson(lessons.length + 1)} isNew />
    );
  } else if (existing) {
    body = <LessonForm key={existing.id} initial={existing} isNew={false} />;
  } else {
    body = <p className="panel-notice">{status === "online" ? `Không tìm thấy bài “${lessonId}”.` : "Đang tải…"}</p>;
  }

  return (
    <>
      <Link href="/admin/exercises" className="btn btn-small btn-ghost">← Bài học</Link>
      <h1 className="admin-title">{lessonId ? `Sửa bài: ${existing?.title ?? lessonId}` : "Thêm bài mới"}</h1>
      {body}
    </>
  );
}
