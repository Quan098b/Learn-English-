// Renders the beginner-flow components to HTML through Vite's SSR loader
// (handles TSX), so the real components are exercised without a browser.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let load;
let lesson;
const speech = { supported: true, enabled: true, speak: async () => true };

before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  load = (path) => server.ssrLoadModule(path);
  const { parseLessonFile } = await load("/lib/lesson-validator.ts");
  const result = parseLessonFile(await readFile(new URL("../data/default-lessons/lesson-04.lesson.json", import.meta.url), "utf8"));
  assert.ok(result.ok);
  lesson = result.lesson;
});

after(async () => {
  await server?.close();
});

const html = (component, props) => renderToStaticMarkup(createElement(component, props));
const text = (markup) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("theory renders: paragraphs, pronoun cards, to-be table and tip", async () => {
  const { TheorySectionView } = await load("/components/student/TheorySectionView.tsx");
  const cards = text(html(TheorySectionView, { section: lesson.theory.find((t) => t.items), speech }));
  assert.match(cards, /It/);
  assert.match(cards, /Dùng khi:/);
  assert.match(cards, /My cat is small\. It is very cute\./);
  assert.match(cards, /Nghe ví dụ/);

  const table = html(TheorySectionView, { section: lesson.theory.find((t) => t.table), speech });
  assert.match(table, /<table/);
  assert.match(text(table), /I am I am a student./);
  assert.match(text(table), /Mẹo nhớ/);
});

test("learn page starts with 'Bạn sẽ học gì?' and the step navigation", async () => {
  const { LearnPage } = await load("/components/student/LearnPage.tsx");
  const page = text(html(LearnPage, { lesson }));
  assert.match(page, /Bạn sẽ học gì\?/);
  assert.match(page, /Sau bài này bạn sẽ biết/);
  for (const step of ["Học quy tắc", "Từ vựng", "Xem ví dụ", "Luyện tập", "Kiểm tra", "Ôn lỗi"]) {
    assert.ok(page.includes(step), `missing step ${step}`);
  }
  assert.match(page, /Tiếp tục →/);
  assert.match(page, /← Quay lại/);
});

test("examples render sentence, meaning, reasoning, breakdown and 'Nghe câu'", async () => {
  const { ExampleCard } = await load("/components/student/ExampleCard.tsx");
  const one = text(html(ExampleCard, { example: lesson.examples[2], index: 2, speech }));
  assert.match(one, /Ví dụ 3/);
  assert.match(one, /My cat is small\. It is cute\./);
  assert.match(one, /My cat \(con mèo của tôi\) → một con vật → It/);
  assert.match(one, /Nghe câu/);
  const withBreakdown = text(html(ExampleCard, { example: lesson.examples.find((e) => e.breakdown), index: 5, speech }));
  assert.match(withBreakdown, /chủ ngữ/);
});

test("guided practice shows no hint and no answer before the learner asks", async () => {
  const { GuidedPractice } = await load("/components/student/GuidedPractice.tsx");
  const markup = html(GuidedPractice, { items: lesson.guidedPractice, speech, onComplete: () => {} });
  const page = text(markup);
  assert.match(page, /Luyện cùng hướng dẫn/);
  assert.match(page, /không tính điểm/);
  assert.match(page, /Gợi ý/);
  assert.doesNotMatch(page, /Gợi ý 1\/3/);
  assert.doesNotMatch(page, /Lan là một người nữ/);
  // No spoken/complete sentence (which contains the answer) before answering.
  assert.doesNotMatch(page, /Nghe câu/);
  assert.doesNotMatch(page, /She is my friend/);
  assert.match(markup, /placeholder="Nhập từ còn thiếu\.\.\."/);
});

test("test intro asks to study first and does not start an attempt", async () => {
  const { ExerciseSession } = await load("/components/student/ExerciseSession.tsx");
  const page = text(html(ExerciseSession, { lesson, userName: "Quân", onActivity: () => {}, onExit: () => {} }));
  assert.match(page, /Kiểm tra: /);
  assert.match(page, /tính điểm/);
  assert.match(page, /Bắt đầu kiểm tra|Vẫn làm kiểm tra/);
  assert.doesNotMatch(page, /Câu 1 \/ 10/);
});

test("result screen lists wrong answers with why, and offers review", async () => {
  const { ResultScreen } = await load("/components/student/ResultScreen.tsx");
  const answers = lesson.questions.map((q) => q.correctAnswer);
  answers[3] = "we";
  const page = text(html(ResultScreen, {
    lesson, answers, mode: "test", attemptNumber: 2,
    onReview: () => {}, onRetry: () => {}, onHome: () => {},
  }));
  assert.match(page, /9 \/ 10/);
  assert.match(page, /Điểm: 90%/);
  assert.match(page, /Xem lại câu sai/);
  assert.match(page, /Câu 4/);
  assert.match(page, /Bạn trả lời ✗ we/);
  assert.match(page, /Đáp án ✓ It/);
  assert.match(page, /Tại sao\?/);
  assert.match(page, /Vì sao không phải “we”\?/);
  assert.match(page, /We nghĩa là chúng tôi/);
  assert.match(page, /Ôn câu sai \(1\)/);
  assert.match(page, /Làm lại câu này/);
});

test("player feedback uses the structured explanation for a wrong typed answer", async () => {
  const { ExercisePlayer } = await load("/components/student/ExercisePlayer.tsx");
  const page = text(html(ExercisePlayer, {
    lesson, index: 3, answer: "we", onAnswer: () => {}, onNext: () => {}, onExit: () => {},
    speech: { ...speech, autoPlay: false },
  }));
  assert.match(page, /Chưa đúng/);
  assert.match(page, /Đáp án đúng: It/);
  assert.match(page, /My cat is small\. It is very cute\./);
  assert.match(page, /Vì sao không phải “we”\?/);
});

test("mobile: new layouts wrap or scroll inside their box", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.stepper-wrap \{ overflow-x: auto;/);
  assert.match(css, /\.term-grid \{[^}]*minmax\(min\(100%, 260px\), 1fr\)/);
  assert.match(css, /\.learn-nav \{[^}]*flex-wrap: wrap;/);
  assert.match(css, /\.theory-table \.table th, \.theory-table \.table td \{ white-space: normal; \}/);
  assert.match(css, /\.mistake-question \{[^}]*overflow-wrap: anywhere;/);
});
