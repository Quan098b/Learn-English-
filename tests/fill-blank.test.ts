import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  correctAnswerLabel,
  isAnswerCorrect,
  questionOptions,
  type Question,
} from "../lib/lesson-schema.ts";
import { parseLessonFile, validateLesson } from "../lib/lesson-validator.ts";
import { parseLessonsSnapshot } from "../lib/lessons.ts";

const options = [
  { id: "A", text: "He" },
  { id: "B", text: "She" },
  { id: "C", text: "It" },
  { id: "D", text: "They" },
];

const typed: Question = {
  id: "q1",
  type: "fill_blank",
  prompt: "Nhập từ còn thiếu vào chỗ trống.",
  display: "Lan is a girl. ___ is my friend.",
  correctAnswer: "She",
  acceptedAnswers: ["she"],
};

/** Exactly what the production database still holds for old lessons. */
const legacy: Question = {
  id: "q1",
  type: "fill_blank",
  prompt: "Chọn từ đúng để điền vào chỗ trống.",
  display: "Lan is a girl. ___ is my friend.",
  options,
  correctAnswer: "B",
};

test("1. fill_blank never returns options to render (new and legacy)", () => {
  assert.equal(questionOptions(typed), null);
  assert.equal(questionOptions(legacy), null);
});

test("2–4. typed answer: She / she / ' SHE ' are all correct", () => {
  assert.ok(isAnswerCorrect(typed, "She"));
  assert.ok(isAnswerCorrect(typed, "she"));
  assert.ok(isAnswerCorrect(typed, " SHE "));
  assert.ok(isAnswerCorrect(typed, "  She  "));
  assert.ok(!isAnswerCorrect(typed, "He"));
  assert.ok(!isAnswerCorrect(typed, ""));
  assert.ok(!isAnswerCorrect(typed, "B"));
});

test("acceptedAnswers still count as correct", () => {
  const q: Question = { ...typed, correctAnswer: "are", acceptedAnswers: ["'re"] };
  assert.ok(isAnswerCorrect(q, "'re"));
  assert.ok(isAnswerCorrect(q, "ARE"));
});

test("5. legacy fill_blank: correctAnswer 'B' resolves to 'She' for typed input", () => {
  assert.ok(isAnswerCorrect(legacy, "She"));
  assert.ok(isAnswerCorrect(legacy, " she "));
  assert.ok(!isAnswerCorrect(legacy, "B"));
  assert.ok(!isAnswerCorrect(legacy, "He"));
});

test("6. legacy fill_blank: correctAnswerLabel shows 'She', not 'B'", () => {
  assert.equal(correctAnswerLabel(legacy), "She");
  assert.equal(correctAnswerLabel(typed), "She");
});

test("7. multiple_choice still works", () => {
  const q: Question = { id: "q2", type: "multiple_choice", prompt: '"they" nghĩa là gì?', options, correctAnswer: "D" };
  assert.deepEqual(questionOptions(q), options);
  assert.ok(isAnswerCorrect(q, "D"));
  assert.ok(!isAnswerCorrect(q, "They"));
  assert.equal(correctAnswerLabel(q), "D. They");
});

test("8. listen_choose still works", () => {
  const q: Question = { id: "q3", type: "listen_choose", prompt: "Nghe và chọn", speak: "she", options, correctAnswer: "B" };
  assert.deepEqual(questionOptions(q), options);
  assert.ok(isAnswerCorrect(q, "B"));
  assert.ok(!isAnswerCorrect(q, "A"));
  assert.equal(correctAnswerLabel(q), "B. She");
});

test("validator normalises legacy fill_blank to a typed answer with a warning", () => {
  const result = validateLesson({
    schemaVersion: 1,
    id: "fill-blank-01",
    order: 4,
    title: "Điền từ",
    level: "A1",
    published: true,
    questions: [legacy],
  });
  assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
  const q = result.lesson.questions[0];
  assert.equal(q.type, "fill_blank");
  assert.equal(q.correctAnswer, "She");
  assert.equal("options" in q ? q.options : undefined, undefined);
  assert.ok(result.warnings.some((w) => /định dạng cũ/.test(w.message)));
});

test("production-shaped Firebase snapshot (legacy, arrays as objects) stays readable", () => {
  const stored = parseLessonsSnapshot({
    "fill-blank-01": {
      schemaVersion: 1,
      order: 4,
      title: "Điền từ",
      level: "A1",
      published: true,
      questions: {
        0: { ...legacy, options: { 0: options[0], 1: options[1], 2: options[2], 3: options[3] } },
      },
    },
  });
  assert.equal(stored.length, 1);
  assert.ok(stored[0].ok);
  const q = stored[0].ok ? stored[0].lesson.questions[0] : null;
  assert.ok(q && isAnswerCorrect(q, "she"));
  assert.equal(q && questionOptions(q), null);
});

test("new fill_blank files need no options; default lesson 4 is fully typed", async () => {
  const result = parseLessonFile(await readFile(new URL("../data/default-lessons/lesson-04.lesson.json", import.meta.url), "utf8"));
  assert.ok(result.ok);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.lesson.questions.length, 10);
  for (const q of result.lesson.questions) {
    assert.equal(q.type, "fill_blank");
    assert.equal(questionOptions(q), null);
    assert.ok(!/^[A-D]$/.test(q.correctAnswer), `${q.id} still uses an option id`);
  }
  const q1 = result.lesson.questions[0];
  assert.equal(q1.display, "Lan is a girl. ___ is my friend.");
  assert.equal(q1.correctAnswer, "She");
  assert.ok(isAnswerCorrect(q1, "she"));
});
