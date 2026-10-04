import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

const TITLE = "English Practice | Học tiếng Anh cùng nhau";
const DESCRIPTION = "Luyện từ vựng, phiên âm IPA và bài tập tiếng Anh trực tuyến.";

test("server-renders the English practice home page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="vi">/i);
  assert.match(html, /English Practice/);
  assert.match(html, /Hôm nay cùng luyện tiếng Anh nhé\./);
  assert.match(html, /Đang học cùng bạn/);
  assert.match(html, />Bài học</);

  // The old graduation microsite is gone.
  assert.doesNotMatch(html, /Kim Chi|tốt nghiệp|chi-graduation/i);
  // No fake presence data is rendered on the server.
  assert.doesNotMatch(html, /class="user-row"/);
  assert.doesNotMatch(html, /khanhquan\.lol|smartivcare\.io\.vn/i);
});

test("server-renders student and admin routes through the catch-all page", async () => {
  for (const path of ["/learn/pronouns-01", "/exercise/pronouns-01", "/admin", "/admin/exercises"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /<html lang="vi">/i, path);
  }
  const admin = await (await render("/admin")).text();
  assert.match(admin, /Đang kiểm tra đăng nhập/);
  // No admin data before the login check.
  assert.doesNotMatch(admin, /Đang online|Học viên<\/h1>/);
});

test("renders the new metadata", async () => {
  const html = await (await render()).text();
  const escapedTitle = TITLE.replace(/[|]/g, "\\|");
  assert.match(html, new RegExp(`<title>${escapedTitle}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${DESCRIPTION}"`));
  assert.ok(html.includes(`<meta property="og:title" content="${TITLE}"`));
  assert.doesNotMatch(html, /og\.png/);
});

test("keeps the Firebase Hosting HTML in sync with the metadata", async () => {
  const firebaseHtml = await readFile(new URL("../firebase-site/index.html", import.meta.url), "utf8");
  assert.ok(firebaseHtml.includes(`<title>${TITLE}</title>`));
  assert.ok(firebaseHtml.includes(`content="${DESCRIPTION}"`));
  assert.doesNotMatch(firebaseHtml, /Kim Chi|tốt nghiệp/i);
});

test("keeps deployment origins and Firebase config configurable and secret-free", async () => {
  const [layout, firebaseHtml, firebaseLib, exampleEnv, gitignore] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../firebase-site/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /process\.env\.NEXT_PUBLIC_SITE_URL/);
  assert.match(firebaseHtml, /%SITE_URL%/);
  assert.match(exampleEnv, /^NEXT_PUBLIC_SITE_URL=http:\/\/localhost:3000$/m);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);

  for (const key of [
    "FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_DATABASE_URL", "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET", "FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_APP_ID",
    "ADMIN_USERNAME", "ADMIN_EMAIL",
  ]) {
    // Listed in .env.example without a value, read from env in code.
    assert.match(exampleEnv, new RegExp(`^NEXT_PUBLIC_${key}=$`, "m"));
    assert.match(firebaseLib, new RegExp(`process\\.env\\.NEXT_PUBLIC_${key}\\b`));
  }

  for (const source of [layout, firebaseHtml, firebaseLib, exampleEnv]) {
    assert.doesNotMatch(source, /khanhquan\.lol|smartivcare\.io\.vn/i);
    assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}/);
  }
});

test("admin password is never part of the source, public assets or env template", async () => {
  const roots = ["app", "components", "lib", "hooks", "public", "firebase-site", "data"];
  for (const root of roots) {
    const dir = fileURLToPath(new URL(`../${root}/`, import.meta.url));
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(tsx?|mjs|js|json|html|css|svg)$/.test(entry.name)) continue;
      const text = await readFile(join(entry.parentPath, entry.name), "utf8");
      assert.doesNotMatch(text, /ADMIN_PASSWORD|NEXT_PUBLIC_ADMIN_PASS/i, entry.name);
      // signInWithEmailAndPassword must never receive a string literal.
      assert.doesNotMatch(text, /signInWithEmailAndPassword\([^)]*["'`][^"'`]{4,}["'`]\s*\)/, entry.name);
    }
  }
  const exampleEnv = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  // No password variable at all (comments may mention the word).
  assert.doesNotMatch(exampleEnv, /^[A-Z_]*PASS[A-Z_]*=/m);
});

test("database rules: deny by default, admin-only lesson writes, per-uid student data", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8")).rules;
  const isAdmin = "root.child('admins').child(auth.uid).val() === true";
  assert.equal(rules[".read"], false);
  assert.equal(rules[".write"], false);
  assert.equal(rules.admins.$uid[".write"], false);
  assert.ok(rules.lessons.$lessonId[".write"].includes(isAdmin));
  assert.match(rules.lessons[".read"], /query\.orderByChild === 'published'/);
  assert.match(rules.lessons[".read"], /query\.equalTo === true/);
  assert.ok(rules.attempts[".read"].includes(isAdmin));
  assert.ok(rules.userExerciseStats[".read"].includes(isAdmin));
  assert.ok(rules.users[".read"].includes(isAdmin));
  for (const node of [
    rules.presenceSessions.$uid,
    rules.users.$uid,
    rules.attempts.$uid.$exerciseId.$attemptId,
    rules.userExerciseStats.$uid.$exerciseId,
  ]) {
    assert.match(node[".write"], /auth\.uid === \$uid/);
  }
  const session = rules.presenceSessions.$uid.$sessionId;
  assert.equal(session.$other[".validate"], false);
  assert.match(session.name[".validate"], /length <= 30/);
  for (const field of [
    "name", "online", "state", "exerciseId", "exerciseTitle", "currentQuestion",
    "totalQuestions", "progress", "connectedAt", "lastSeen",
  ]) {
    assert.ok(session[field], `missing rule for ${field}`);
  }
});
