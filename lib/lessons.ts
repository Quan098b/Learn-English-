import { getFirebase, getStudentSession } from "./firebase.ts";
import { sortLessons, type Lesson } from "./lesson-schema.ts";
import { validateLesson, type ValidationIssue } from "./lesson-validator.ts";
import type { ConnectionStatus } from "./presence.ts";

export const LESSONS_PATH = "lessons";

export type StoredLesson =
  | { ok: true; id: string; lesson: Lesson }
  | { ok: false; id: string; title: string; errors: ValidationIssue[] };

/** Normalises the raw `lessons` node (Firebase turns arrays into objects, drops empties). */
export function parseLessonsSnapshot(raw: unknown): StoredLesson[] {
  if (typeof raw !== "object" || raw === null) return [];
  return Object.entries(raw as Record<string, unknown>).map(([id, value]) => {
    const result = validateLesson(
      typeof value === "object" && value !== null ? { ...value, id } : value,
    );
    if (result.ok) return { ok: true as const, id, lesson: result.lesson };
    const title =
      typeof value === "object" && value !== null && typeof (value as { title?: unknown }).title === "string"
        ? (value as { title: string }).title
        : id;
    return { ok: false as const, id, title, errors: result.errors };
  });
}

export function validLessons(stored: readonly StoredLesson[]): Lesson[] {
  return sortLessons(stored.flatMap((s) => (s.ok ? [s.lesson] : [])));
}

/** Firebase cannot store `undefined`; strip it (and keep the id out of the body). */
function toDatabaseValue(lesson: Lesson) {
  const { id: _id, ...body } = lesson;
  void _id;
  return JSON.parse(JSON.stringify(body)) as Omit<Lesson, "id">;
}

/**
 * Students: only published lessons, via a query the security rules allow
 * (`orderByChild('published').equalTo(true)`).
 */
export function subscribePublishedLessons(
  onLessons: (lessons: Lesson[]) => void,
  onStatus: (status: ConnectionStatus) => void,
): () => void {
  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  void getStudentSession()
    .then((session) => {
      if (disposed) return;
      if (!session) {
        onStatus("disabled");
        return;
      }
      const { db, dbSdk: fb } = session.client;
      const query = fb.query(fb.ref(db, LESSONS_PATH), fb.orderByChild("published"), fb.equalTo(true));
      unsubscribe = fb.onValue(
        query,
        (snapshot) => {
          onStatus("online");
          onLessons(validLessons(parseLessonsSnapshot(snapshot.val())).filter((l) => l.published));
        },
        (error) => {
          console.warn("[lessons]", error);
          onStatus("error");
        },
      );
    })
    .catch((error: unknown) => {
      if (disposed) return;
      console.warn("[lessons]", error);
      onStatus("error");
    });
  return () => {
    disposed = true;
    unsubscribe?.();
  };
}

async function adminDb() {
  const client = await getFirebase("admin");
  if (!client) throw new Error("Firebase chưa được cấu hình.");
  return client;
}

export async function lessonExists(id: string): Promise<boolean> {
  const { db, dbSdk: fb } = await adminDb();
  return (await fb.get(fb.ref(db, `${LESSONS_PATH}/${id}`))).exists();
}

export async function saveLesson(lesson: Lesson): Promise<void> {
  const { db, dbSdk: fb } = await adminDb();
  await fb.set(fb.ref(db, `${LESSONS_PATH}/${lesson.id}`), toDatabaseValue(lesson));
}

/** Deletes only the lesson; attempts and stats keep their title snapshot. */
export async function deleteLesson(id: string): Promise<void> {
  const { db, dbSdk: fb } = await adminDb();
  await fb.remove(fb.ref(db, `${LESSONS_PATH}/${id}`));
}

export async function setLessonPublished(id: string, published: boolean): Promise<void> {
  const { db, dbSdk: fb } = await adminDb();
  await fb.update(fb.ref(db, `${LESSONS_PATH}/${id}`), { published });
}

/** Writes `order` = 1..n following the given id order, in one atomic update. */
export async function reorderLessons(ids: readonly string[]): Promise<void> {
  const { db, dbSdk: fb } = await adminDb();
  const updates: Record<string, number> = {};
  ids.forEach((id, index) => {
    updates[`${LESSONS_PATH}/${id}/order`] = index + 1;
  });
  await fb.update(fb.ref(db), updates);
}
