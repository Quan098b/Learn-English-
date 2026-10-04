import lesson01 from "../data/default-lessons/lesson-01.lesson.json";
import lesson02 from "../data/default-lessons/lesson-02.lesson.json";
import lesson03 from "../data/default-lessons/lesson-03.lesson.json";
import lesson04 from "../data/default-lessons/lesson-04.lesson.json";
import type { Lesson } from "./lesson-schema.ts";
import { validateLesson } from "./lesson-validator.ts";

/**
 * The four starter lessons, in the same *.lesson.json format admins import.
 * Used to seed the database (Admin › Cài đặt) and as an offline fallback when
 * Firebase is not configured.
 */
export const defaultLessons: Lesson[] = [lesson01, lesson02, lesson03, lesson04].flatMap((raw) => {
  const result = validateLesson(raw);
  return result.ok ? [result.lesson] : [];
});
