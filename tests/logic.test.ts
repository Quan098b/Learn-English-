import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  attemptDisplayStatus,
  flattenAttempts,
  STALE_ATTEMPT_MS,
  statsAfterComplete,
  statsAfterStart,
  summarizeExercise,
  summarizeUser,
} from "../lib/attempt-model.ts";
import { isAnswerCorrect, visibleLessons, type Lesson } from "../lib/lesson-schema.ts";
import { parseLessonFile, validateLesson } from "../lib/lesson-validator.ts";
import {
  activityFields,
  aggregateOnlineUsers,
  buildOnlineUsers,
  liveSessions,
  sanitizeName,
  STALE_AFTER_MS,
  summarizeUsers,
  type PresenceSession,
} from "../lib/presence-model.ts";
import { parseResults } from "../lib/results.ts";
import { parseRoute } from "../lib/router.ts";
import { computeProgress, computeScore, formatDuration } from "../lib/scoring.ts";
import { parseSettings, speechLanguage } from "../lib/settings.ts";
import { pickVoice } from "../lib/speech.ts";

const LESSON_DIR = new URL("../data/default-lessons/", import.meta.url);
const TEMPLATE = new URL("../data/templates/lesson-template.lesson.json", import.meta.url);

async function loadDefaultLessons(): Promise<Lesson[]> {
  const files = (await readdir(LESSON_DIR)).filter((f) => f.endsWith(".lesson.json")).sort();
  return Promise.all(
    files.map(async (file) => {
      const result = parseLessonFile(await readFile(new URL(file, LESSON_DIR), "utf8"));
      assert.ok(result.ok, `${file}: ${JSON.stringify(!result.ok && result.errors)}`);
      return result.lesson;
    }),
  );
}

function validLesson(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: "pronouns-01",
    order: 1,
    title: "Đại từ nhân xưng",
    level: "A1",
    published: true,
    audio: { enabled: true, mode: "tts", language: "en-US", rate: 0.85 },
    questions: [
      {
        id: "q1",
        type: "multiple_choice",
        prompt: '"they" nghĩa là gì?',
        speak: "they",
        options: [
          { id: "A", text: "tôi" },
          { id: "B", text: "họ" },
          { id: "C", text: "chúng tôi" },
          { id: "D", text: "cô ấy" },
        ],
        correctAnswer: "B",
        explanation: "they = họ",
      },
      {
        id: "q2",
        type: "fill_blank",
        prompt: "Lan is a girl. ___ is my friend.",
        correctAnswer: "She",
        acceptedAnswers: ["she"],
      },
    ],
  };
}

// ---------- Lesson validator ----------

test("validator: valid lesson passes", () => {
  const result = validateLesson(validLesson());
  assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
  assert.equal(result.lesson.questions.length, 2);
});

test("validator: missing title fails", () => {
  const lesson = validLesson();
  delete lesson.title;
  const result = validateLesson(lesson);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.errors.some((e) => e.where === "title" && /Thiếu/.test(e.message)));
});

test("validator: duplicate question id fails", () => {
  const lesson = validLesson();
  (lesson.questions as { id: string }[])[1].id = "q1";
  const result = validateLesson(lesson);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.errors.some((e) => /trùng/.test(e.message) && e.where.includes("Câu 2")));
});

test("validator: correctAnswer not in options fails with a helpful message", () => {
  const lesson = validLesson();
  (lesson.questions as { correctAnswer: string }[])[0].correctAnswer = "E";
  const result = validateLesson(lesson);
  assert.equal(result.ok, false);
  const issue = !result.ok ? result.errors.find((e) => e.message.includes('"E"')) : undefined;
  assert.ok(issue);
  assert.match(issue.where, /Câu 1 \(q1\)/);
  assert.match(issue.fix, /A, B, C, D/);
});

test("validator: rejects Firebase-unsafe ids, bad level, few options, missing fill answer", () => {
  for (const id of ["a/b", "a.b", "a#b", "a$b", "a[b]", "Upper"]) {
    assert.equal(validateLesson({ ...validLesson(), id }).ok, false, id);
  }
  assert.equal(validateLesson({ ...validLesson(), level: "Z9" }).ok, false);

  const fewOptions = validLesson();
  (fewOptions.questions as { options: unknown[] }[])[0].options = [{ id: "B", text: "họ" }];
  assert.equal(validateLesson(fewOptions).ok, false);

  const noFillAnswer = validLesson();
  delete (noFillAnswer.questions as Record<string, unknown>[])[1].correctAnswer;
  assert.equal(validateLesson(noFillAnswer).ok, false);

  const longSpeak = validLesson();
  (longSpeak.questions as Record<string, unknown>[])[0].speak = "x".repeat(201);
  assert.equal(validateLesson(longSpeak).ok, false);

  const unknownField = { ...validLesson(), teacher: "Quân" };
  assert.equal(validateLesson(unknownField).ok, false);
});

test("validator: listen_choose needs speak", () => {
  const lesson = validLesson();
  (lesson.questions as Record<string, unknown>[])[0].type = "listen_choose";
  delete (lesson.questions as Record<string, unknown>[])[0].speak;
  const result = validateLesson(lesson);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.errors.some((e) => /speak/.test(e.fix)));
});

test("validator: invalid JSON reports the line", () => {
  const result = parseLessonFile('{\n  "schemaVersion": 1,\n  "id": "x",,\n}');
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /^Dòng \d+$/.test(result.errors[0].where));
});

test("validator: accepts Firebase array-as-object shape", () => {
  const lesson = validLesson();
  lesson.questions = Object.fromEntries((lesson.questions as unknown[]).map((q, i) => [String(i), q]));
  assert.ok(validateLesson(lesson).ok);
});

test("default lessons and template are valid schemaVersion 1 files", async () => {
  const lessons = await loadDefaultLessons();
  assert.deepEqual(
    lessons.map((l) => [l.id, l.title, l.questions.length]),
    [
      ["pronouns-01", "Đại từ nhân xưng", 10],
      ["basic-vocabulary-01", "Từ vựng cơ bản", 15],
      ["ipa-01", "Phiên âm IPA", 15],
      ["fill-blank-01", "Điền từ: Đại từ và am / is / are", 10],
    ],
  );
  const words = lessons[1].vocabulary?.map((v) => `${v.word} ${v.ipa} ${v.meaning}`);
  assert.equal(words?.length, 15);
  assert.ok(words?.includes("they /ðeɪ/ họ"));
  assert.ok(words?.includes("thanks /θæŋks/ cảm ơn"));
  const types = new Set(lessons.flatMap((l) => l.questions.map((q) => q.type)));
  for (const t of ["word_to_meaning", "listen_choose", "meaning_to_word", "ipa_to_word", "fill_blank"]) {
    assert.ok(types.has(t as never), t);
  }
  assert.ok(parseLessonFile(await readFile(TEMPLATE, "utf8")).ok);
});

// ---------- Answers, score, progress ----------

test("answers: option ids and typed text", () => {
  const result = validateLesson(validLesson());
  assert.ok(result.ok);
  const [choice, fill] = result.lesson.questions;
  assert.ok(isAnswerCorrect(choice, "B"));
  assert.ok(!isAnswerCorrect(choice, "A"));
  assert.ok(isAnswerCorrect(fill, "  she "));
  assert.ok(isAnswerCorrect(fill, "She."));
  assert.ok(!isAnswerCorrect(fill, "he"));
});

test("score: 8/10 = 80%", async () => {
  const lesson = (await loadDefaultLessons())[3];
  const right = lesson.questions.map((q) => q.correctAnswer);
  const eight = right.map((a, i) => (i < 2 ? "wrong" : a));
  assert.deepEqual(computeScore(lesson.questions, eight), { correct: 8, total: 10, percent: 80 });
  assert.deepEqual(computeScore(lesson.questions, right), { correct: 10, total: 10, percent: 100 });
  assert.deepEqual(computeScore(lesson.questions, right.map(() => null)), { correct: 0, total: 10, percent: 0 });
});

test("progress: 4/10 = 40%", () => {
  assert.equal(computeProgress(4, 10), 40);
  assert.equal(computeProgress(4, 15), 27);
  assert.equal(computeProgress(12, 10), 100);
  assert.equal(computeProgress(1, 0), 0);
  assert.equal(formatDuration(130_000), "2 phút 10 giây");
  assert.equal(formatDuration(54_000), "54 giây");
});

// ---------- Attempts ----------

test("attempt: attemptCount increases by one per start, never overwritten", () => {
  const info = { userName: "Quân", exerciseTitle: "Đại từ nhân xưng" };
  let stats: unknown = null;
  for (let i = 1; i <= 4; i += 1) {
    stats = statsAfterStart(stats, info, 1000 * i);
    assert.equal((stats as { attemptCount: number }).attemptCount, i);
  }
  stats = statsAfterComplete(stats, { ...info, score: 90 }, 5000);
  stats = statsAfterComplete(stats, { ...info, score: 70 }, 6000);
  assert.deepEqual(stats, {
    ...info,
    attemptCount: 4,
    completedCount: 2,
    lastScore: 70,
    bestScore: 90,
    lastAttemptAt: 6000,
  });
  // Retry = a new start: count goes to 5, scores kept.
  stats = statsAfterStart(stats, info, 7000);
  assert.equal((stats as { attemptCount: number }).attemptCount, 5);
  assert.equal((stats as { bestScore: number }).bestScore, 90);
});

test("attempt: flatten, stale detection, summaries", () => {
  const raw = {
    userA: {
      "ipa-01": {
        a1: { userName: "Quân", exerciseTitle: "Phiên âm IPA", attemptNumber: 1, startedAt: 100, finishedAt: 200, correctAnswers: 8, totalQuestions: 10, score: 80, durationMs: 100, status: "completed" },
        a2: { userName: "Quân", exerciseTitle: "Phiên âm IPA", attemptNumber: 2, startedAt: 300, correctAnswers: 0, totalQuestions: 10, score: 0, durationMs: 0, status: "in_progress" },
        junk: { status: "weird" },
      },
    },
  };
  const attempts = flattenAttempts(raw);
  assert.deepEqual(attempts.map((a) => a.attemptNumber), [2, 1]);
  assert.equal(attemptDisplayStatus(attempts[0], 300 + STALE_ATTEMPT_MS + 1, false), "stale");
  assert.equal(attemptDisplayStatus(attempts[0], 300 + STALE_ATTEMPT_MS + 1, true), "in_progress");
  assert.equal(attemptDisplayStatus(attempts[1], 10_000_000, false), "completed");
  assert.equal(flattenAttempts(raw.userA, "userA").length, 2);

  const tree = {
    userA: { "ipa-01": { userName: "Quân", exerciseTitle: "IPA", attemptCount: 5, completedCount: 4, lastScore: 80, bestScore: 87, lastAttemptAt: 10 } },
    userB: { "ipa-01": { userName: "Chi", exerciseTitle: "IPA", attemptCount: 2, completedCount: 2, lastScore: 70, bestScore: 80, lastAttemptAt: 20 } },
  };
  const ex = summarizeExercise(tree, "ipa-01");
  assert.equal(ex.learners, 2);
  assert.equal(ex.attempts, 7);
  assert.equal(ex.averageLastScore, 75);
  assert.equal(ex.bestScore, 87);
  assert.equal(ex.worstLastScore, 70);
  assert.equal(summarizeUser(tree.userA).totalAttempts, 5);
});

// ---------- Presence ----------

const NOW = 1_800_000_000_000;

function session(userId: string, sessionId: string, overrides: Partial<PresenceSession> = {}) {
  return {
    name: "Quân",
    online: true,
    state: "viewing",
    currentQuestion: 0,
    totalQuestions: 0,
    progress: 0,
    attemptNumber: 0,
    connectedAt: NOW - 5000,
    lastSeen: NOW - 1000,
    updatedAt: NOW - 1000,
    ...overrides,
  };
}

test("presence: 1 user + 2 tabs = 1 online user (doing tab wins)", () => {
  const snapshot = {
    userAAAAAA: {
      s_tab1: session("userAAAAAA", "s_tab1"),
      s_tab2: session("userAAAAAA", "s_tab2", {
        state: "doing",
        exerciseId: "ipa-01",
        exerciseTitle: "Phiên âm IPA",
        currentQuestion: 7,
        totalQuestions: 15,
        progress: 47,
        attemptNumber: 3,
      }),
    },
  };
  const users = buildOnlineUsers(snapshot, NOW, null);
  assert.equal(users.length, 1);
  assert.equal(users[0].sessionCount, 2);
  assert.equal(users[0].state, "doing");
  assert.equal(users[0].currentQuestion, 7);
  assert.equal(users[0].attemptNumber, 3);
  assert.deepEqual(summarizeUsers(users), { online: 1, doing: 1 });
});

test("presence: 2 users = 2 online, even with the same name", () => {
  const snapshot = {
    userAAAAAA: { s_tab1: session("userAAAAAA", "s_tab1") },
    userBBBBBB: { s_tab1: session("userBBBBBB", "s_tab1") },
  };
  const users = buildOnlineUsers(snapshot, NOW, "userBBBBBB");
  assert.equal(users.length, 2);
  assert.equal(users[0].userId, "userBBBBBB");
  assert.ok(users[0].isSelf);
});

test("presence: closing one tab keeps the user online", () => {
  const twoTabs = {
    userAAAAAA: { s_tab1: session("userAAAAAA", "s_tab1"), s_tab2: session("userAAAAAA", "s_tab2") },
  };
  // onDisconnect removed tab 2's node:
  const oneTab = { userAAAAAA: { s_tab1: twoTabs.userAAAAAA.s_tab1 } };
  assert.equal(buildOnlineUsers(twoTabs, NOW, null).length, 1);
  assert.equal(buildOnlineUsers(oneTab, NOW, null).length, 1);
  // ...and when the last one goes, the user is gone.
  assert.equal(buildOnlineUsers({ userAAAAAA: {} }, NOW, null).length, 0);
});

test("presence: stale and malformed sessions are ignored", () => {
  const snapshot = {
    userAAAAAA: { s_tab1: session("userAAAAAA", "s_tab1", { lastSeen: NOW - STALE_AFTER_MS - 1 }) },
    userBBBBBB: { s_tab1: { ...session("userBBBBBB", "s_tab1"), online: false } },
    "bad/key": { s_tab1: session("x", "s_tab1") },
    userCCCCCC: "junk",
  };
  assert.equal(liveSessions(snapshot, NOW).length, 0);
  assert.deepEqual(aggregateOnlineUsers([], null), []);
});

test("presence: sanitizeName and activity fields", () => {
  assert.equal(sanitizeName("  Quân  "), "Quân");
  assert.equal(sanitizeName("Kim\nChi"), "Kim Chi");
  assert.equal(sanitizeName("a".repeat(50)).length, 30);
  assert.deepEqual(activityFields({ state: "viewing" }).exerciseId, null);
  const doing = activityFields({
    state: "doing",
    exerciseId: "pronouns-01",
    exerciseTitle: "Đại từ nhân xưng",
    currentQuestion: 4,
    totalQuestions: 15,
    progress: 27,
    attemptNumber: 2,
    attemptStartedAt: 123,
  });
  assert.equal(doing.state, "doing");
  assert.equal(doing.currentQuestion, 4);
  assert.equal(doing.progress, 27);
});

// ---------- Lesson visibility ----------

test("visibility: students see only published lessons, sorted by order", () => {
  const lessons = [
    { id: "b", order: 2, title: "B", published: true },
    { id: "hidden", order: 0, title: "H", published: false },
    { id: "a", order: 1, title: "A", published: true },
  ];
  assert.deepEqual(visibleLessons(lessons, "student").map((l) => l.id), ["a", "b"]);
  assert.deepEqual(visibleLessons(lessons, "admin").map((l) => l.id), ["hidden", "a", "b"]);
});

// ---------- Routing, speech, settings, storage ----------

test("router: student and admin routes", () => {
  assert.deepEqual(parseRoute("/"), { name: "home" });
  assert.deepEqual(parseRoute("/learn/pronouns-01"), { name: "learn", lessonId: "pronouns-01" });
  assert.deepEqual(parseRoute("/exercise/ipa-01"), { name: "exercise", lessonId: "ipa-01" });
  assert.deepEqual(parseRoute("/admin"), { name: "admin-dashboard" });
  assert.deepEqual(parseRoute("/admin/users/abc123"), { name: "admin-user", userId: "abc123" });
  assert.deepEqual(parseRoute("/admin/exercises/new"), { name: "admin-exercise-new" });
  assert.deepEqual(parseRoute("/admin/exercises/ipa-01/edit"), { name: "admin-exercise-edit", lessonId: "ipa-01" });
  assert.deepEqual(parseRoute("/admin/import"), { name: "admin-import" });
  assert.deepEqual(parseRoute("/learn/../etc"), { name: "not-found" });
  assert.deepEqual(parseRoute("/nope"), { name: "not-found" });
});

test("speech: picks the exact locale, then any English voice", () => {
  const voices = [
    { lang: "vi-VN", name: "Vi", localService: true, default: true },
    { lang: "en-GB", name: "Daniel", localService: true, default: false },
    { lang: "en-US", name: "Alex", localService: true, default: false },
    { lang: "en-US", name: "Google US English", localService: false, default: false },
    { lang: "en_AU", name: "Karen", localService: true, default: false },
  ];
  assert.equal(pickVoice(voices, "en-US")?.name, "Google US English");
  assert.equal(pickVoice(voices, "en-GB")?.name, "Daniel");
  assert.equal(pickVoice(voices.filter((v) => v.lang !== "en-GB"), "en-GB")?.lang.startsWith("en"), true);
  assert.equal(pickVoice([voices[0]], "en-US"), null);
});

test("settings: defaults, accent and lesson override", () => {
  assert.deepEqual(parseSettings(null), { accent: "US", autoPlay: false, speed: "normal" });
  assert.deepEqual(parseSettings("{bad"), { accent: "US", autoPlay: false, speed: "normal" });
  const uk = parseSettings(JSON.stringify({ accent: "UK", autoPlay: true }));
  assert.equal(speechLanguage(uk), "en-GB");
  assert.equal(speechLanguage(uk, "en-US"), "en-US");
  assert.equal(uk.autoPlay, true);
});

test("local results ignore corrupt storage", () => {
  assert.deepEqual(parseResults("{not json"), {});
  assert.deepEqual(
    parseResults(JSON.stringify({ ipa: { correct: 8, total: 10, percent: 80, finishedAt: 1 }, bad: { correct: "x" } })),
    { ipa: { correct: 8, total: 10, percent: 80, finishedAt: 1 } },
  );
});

test("docs: every complete example in LESSON_FORMAT.md is a valid lesson", async () => {
  const doc = await readFile(new URL("../docs/LESSON_FORMAT.md", import.meta.url), "utf8");
  const blocks = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => b.includes('"schemaVersion"'));
  assert.ok(blocks.length >= 3, `found ${blocks.length} examples`);
  for (const block of blocks) {
    const result = parseLessonFile(block);
    assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
  }
});
