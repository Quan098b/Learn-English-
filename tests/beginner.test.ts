import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseAttempt } from "../lib/attempt-model.ts";
import { checkGuidedAnswer, completedSentence, revealNextHint, visibleHints } from "../lib/guided.ts";
import { isLessonStudied, parseProgress, studySteps } from "../lib/lesson-progress.ts";
import {
  answerText,
  explanationSummary,
  findWhyNot,
  hasLearningContent,
  speakRevealsAnswer,
  type GuidedPracticeItem,
  type Lesson,
  type Question,
} from "../lib/lesson-schema.ts";
import { parseLessonFile, validateLesson } from "../lib/lesson-validator.ts";
import { buildAnswerResults, parseAnswerResults, reviewQuestions, wrongAnswers } from "../lib/review.ts";
import { parseSettings, speechRate } from "../lib/settings.ts";

const minimal = {
  schemaVersion: 1,
  id: "plain-01",
  order: 9,
  title: "Bài cũ không có phần học",
  level: "A1",
  published: true,
  questions: [{ id: "q1", type: "fill_blank", prompt: "x", display: "___ am a student.", correctAnswer: "I" }],
};

async function lesson(file: string): Promise<Lesson> {
  const result = parseLessonFile(await readFile(new URL(`../data/default-lessons/${file}`, import.meta.url), "utf8"));
  assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
  return result.lesson;
}

test("lesson without beginner content is still valid and goes straight to the test", () => {
  const result = validateLesson(minimal);
  assert.ok(result.ok);
  assert.equal(hasLearningContent(result.lesson), false);
  assert.deepEqual(studySteps(result.lesson), []);
  assert.equal(isLessonStudied(result.lesson, undefined), true);
});

test("fill-blank-01 has the full beginner flow with real content", async () => {
  const l = await lesson("lesson-04.lesson.json");
  assert.equal(l.id, "fill-blank-01");
  assert.ok((l.goals?.length ?? 0) >= 4);
  const titles = l.theory?.map((t) => t.title) ?? [];
  for (const expected of ["Chủ ngữ là gì?", "Đại từ là gì?", "am / is / are là gì?"]) {
    assert.ok(titles.includes(expected), `missing theory "${expected}"`);
  }
  assert.ok(l.theory?.some((t) => t.items?.some((i) => i.term === "It" && i.usage)));
  assert.ok(l.theory?.some((t) => t.table?.rows.some((r) => r[0] === "I" && r[1] === "am")));
  assert.ok((l.examples?.length ?? 0) >= 5);
  assert.ok(l.examples?.some((e) => e.breakdown?.length));
  assert.ok((l.guidedPractice?.length ?? 0) >= 5);
  for (const g of l.guidedPractice ?? []) assert.ok(g.hints.length >= 2, `${g.id} needs hints`);
  assert.equal(l.questions.length, 10);
  for (const q of l.questions) {
    assert.equal(q.type, "fill_blank");
    assert.equal(typeof q.explanation, "object", `${q.id} needs a structured explanation`);
  }
  assert.deepEqual(studySteps(l).map((s) => s.id), ["theory", "vocabulary", "examples", "guided"]);
});

test("pronouns-01 is upgraded too", async () => {
  const l = await lesson("lesson-01.lesson.json");
  assert.ok(l.theory?.length && l.examples?.length && l.guidedPractice?.length);
  assert.ok(l.vocabulary?.every((v) => v.usage && v.example && v.exampleMeaning));
});

test("progress: studied only after every available step", async () => {
  const l = await lesson("lesson-04.lesson.json");
  assert.equal(isLessonStudied(l, undefined), false);
  assert.equal(isLessonStudied(l, { theoryViewed: true, examplesViewed: true }), false);
  assert.equal(isLessonStudied(l, { theoryViewed: true, vocabularyViewed: true, examplesViewed: true, guidedCompleted: true }), true);
  assert.deepEqual(parseProgress("{bad"), {});
  assert.deepEqual(parseProgress(JSON.stringify({ x: { theoryViewed: true, junk: 1 } })), { x: { theoryViewed: true } });
});

const guided: GuidedPracticeItem = {
  id: "g1",
  display: "Lan is a girl. ___ is my friend.",
  correctAnswer: "She",
  hints: ["Lan là một người nữ.", "Một người nữ dùng She.", "She đi với is."],
  explanation: {
    summary: "Lan → người nữ → She.",
    whyNot: [{ answer: "He", reason: "He dùng cho người nam." }],
  },
};

test("guided practice: hints open one at a time and never exceed the list", () => {
  let shown = 0;
  assert.deepEqual(visibleHints(shown, guided), []);
  shown = revealNextHint(shown, guided);
  assert.deepEqual(visibleHints(shown, guided), ["Lan là một người nữ."]);
  shown = revealNextHint(shown, guided);
  assert.equal(visibleHints(shown, guided).length, 2);
  shown = revealNextHint(revealNextHint(shown, guided), guided);
  assert.equal(shown, 3);
  assert.equal(visibleHints(shown, guided).length, 3);
});

test("guided practice: checks typed answers with whyNot, and is never scored", async () => {
  assert.deepEqual(checkGuidedAnswer(guided, " she "), { correct: true, whyNot: null });
  assert.deepEqual(checkGuidedAnswer(guided, "he"), { correct: false, whyNot: "He dùng cho người nam." });
  assert.equal(completedSentence(guided.display, "She"), "Lan is a girl. She is my friend.");
  // Guided practice code never touches attempts, results or scoring.
  for (const file of ["../lib/guided.ts", "../components/student/GuidedPractice.tsx", "../components/student/LearnPage.tsx"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /startAttempt|saveResult|computeScore|attempts"/, file);
  }
});

test("structured and plain explanations both work", () => {
  const structured = { summary: "My cat → It.", steps: ["a", "b"], whyNot: [{ answer: "We", reason: "We đi với are." }] };
  assert.equal(explanationSummary(structured), "My cat → It.");
  assert.equal(explanationSummary("It = nó"), "It = nó");
  assert.equal(findWhyNot(structured, " we "), "We đi với are.");
  assert.equal(findWhyNot(structured, "They"), null);
  assert.equal(findWhyNot("plain", "We"), null);

  const ok = validateLesson({ ...minimal, questions: [{ ...minimal.questions[0], explanation: structured }] });
  assert.ok(ok.ok);
  const bad = validateLesson({ ...minimal, questions: [{ ...minimal.questions[0], explanation: { steps: ["x"] } }] });
  assert.equal(bad.ok, false);
});

test("validator rejects broken learning content with clear messages", () => {
  const badTable = validateLesson({ ...minimal, theory: [{ id: "t1", title: "Bảng", table: { headers: ["A", "B"], rows: [["only one"]] } }] });
  assert.ok(!badTable.ok && badTable.errors.some((e) => e.message.includes("table")));
  const noHints = validateLesson({ ...minimal, guidedPractice: [{ id: "g1", display: "___ am.", correctAnswer: "I" }] });
  assert.ok(!noHints.ok && noHints.errors.some((e) => e.message.includes("hints")));
  const emptySection = validateLesson({ ...minimal, theory: [{ id: "t1", title: "Rỗng" }] });
  assert.equal(emptySection.ok, false);
});

test("quiz results: answerResults, wrong answers and review set", async () => {
  const l = await lesson("lesson-04.lesson.json");
  const answers = l.questions.map((q) => q.correctAnswer as string | null);
  answers[3] = "we"; // q4 "My cat… ___ is very cute."
  answers[9] = null; // skipped
  const results = buildAnswerResults(l.questions, answers);
  assert.equal(results.length, 10);
  assert.deepEqual(results[3], { questionId: "q4", answer: "we", correct: false });
  assert.equal(results[9].correct, false);
  assert.equal(results.filter((r) => r.correct).length, 8);

  const wrong = wrongAnswers(l.questions, answers);
  assert.deepEqual(wrong.map((w) => w.question.id), ["q4", "q10"]);
  assert.deepEqual(reviewQuestions(l.questions, wrong).map((q) => q.id), ["q4", "q10"]);
  // The "why not We" note from the lesson is found for the learner's answer.
  assert.match(findWhyNot(wrong[0].question.explanation, "we") ?? "", /We nghĩa là chúng tôi/);

  // Stored on the attempt and read back from Firebase's array-as-object shape.
  const parsed = parseAttempt("u1", "fill-blank-01", "a1", {
    userName: "Quân", exerciseTitle: "Điền từ", attemptNumber: 1, startedAt: 1, status: "completed",
    correctAnswers: 8, totalQuestions: 10, score: 80, durationMs: 1,
    answerResults: { 0: results[0], 1: results[3] },
  });
  assert.equal(parsed?.answerResults.length, 2);
  assert.deepEqual(parseAnswerResults(null), []);
});

test("speech never gives the answer away before answering", () => {
  const typed = { id: "q", type: "fill_blank", prompt: "", correctAnswer: "She" } as Question;
  const meaning = { id: "q", type: "meaning_to_word", prompt: "", options: [], correctAnswer: "A" } as Question;
  const ipa = { id: "q", type: "ipa_to_word", prompt: "", options: [], correctAnswer: "A" } as Question;
  const word = { id: "q", type: "word_to_meaning", prompt: "", options: [], correctAnswer: "A" } as Question;
  assert.equal(speakRevealsAnswer(typed), true);
  assert.equal(speakRevealsAnswer(meaning), true);
  assert.equal(speakRevealsAnswer(ipa), true);
  assert.equal(speakRevealsAnswer(word), false);
  const choice = { id: "q", type: "multiple_choice", prompt: "", options: [{ id: "B", text: "họ" }], correctAnswer: "B" } as Question;
  assert.equal(answerText(choice, "B"), "họ");
  assert.equal(answerText(typed, "we"), "we");
});

test("reading speed: slow / normal / fast", () => {
  assert.equal(parseSettings(null).speed, "normal");
  assert.equal(speechRate(parseSettings(JSON.stringify({ speed: "slow" }))), 0.7);
  assert.equal(speechRate(parseSettings(JSON.stringify({ speed: "fast" }))), 1);
  assert.equal(speechRate(parseSettings(null), 0.9), 0.9);
  assert.equal(speechRate(parseSettings(null)), 0.85);
});
