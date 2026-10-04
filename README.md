# English Practice — Học tiếng Anh cùng nhau

Website luyện tiếng Anh cho một nhóm học cùng nhau (https://khanhquan.lol).

- **Học viên** (`/`, `/learn/{lessonId}`, `/exercise/{lessonId}`): nhập tên, học từ có phát âm,
  làm bài, xem ai đang học realtime.
- **Admin** (`/admin`): đăng nhập, xem ai online / đang làm câu mấy, số lần và điểm từng lần,
  quản lý bài học, import bài bằng file `.lesson.json`.

Database: **Firebase Realtime Database** (không dùng SQL). Định danh: **Firebase Authentication**
(học viên = Anonymous, admin = Email/Password).

## Cấu trúc

```
app/[[...slug]]/page.tsx     mọi đường dẫn → components/App.tsx (router phía client)
firebase-site/               entry SPA cho Firebase Hosting (production)
components/student/          StudentApp, LessonCard, VocabularyCard, ExerciseSession,
                             ExercisePlayer, AnswerOption, SpeechButton, OnlineUsers, ...
components/admin/            AdminApp, AdminLogin, AdminLayout, AdminDashboard, LiveUsers,
                             UserTable, UserDetail, AttemptsTable, LessonsTable, LessonStats,
                             LessonEditor, LessonImporter, LessonPreview, AdminSettings
components/shared/           Link, NameModal, ConfirmDialog, ProgressBar
lib/lesson-schema.ts         kiểu Lesson/Question/... (schemaVersion 1)
lib/lesson-validator.ts      kiểm tra file bài, báo lỗi theo câu + cách sửa
lib/lessons.ts               đọc/ghi lessons trên Firebase
lib/presence-model.ts        gom presence theo user (hàm thuần, có test)
lib/presence.ts              presenceSessions/{uid}/{sessionId} + .info/connected + onDisconnect
lib/attempt-model.ts         thống kê lượt làm (hàm thuần, có test)
lib/attempts.ts              tạo/hoàn thành/bỏ dở attempt, transaction attemptCount
lib/firebase.ts              config từ env, 2 app Firebase riêng (student / admin)
lib/admin-auth.ts            đăng nhập admin (Firebase Email/Password + admins/{uid})
lib/speech.ts, lib/settings.ts  phát âm Web Speech API, giọng US/UK, tự phát âm
data/default-lessons/        4 bài mặc định (*.lesson.json)
data/templates/              lesson-template.lesson.json
docs/LESSON_FORMAT.md        hướng dẫn định dạng file bài + 3 ví dụ
database.rules.json          security rules
```

## Database

```
admins/{uid}: true                                     (tạo tay trong console)
lessons/{lessonId}: Lesson (không có trường id)
users/{uid}: { name, lastActiveAt }
presenceSessions/{uid}/{sessionId}: { name, online, state, exerciseId, exerciseTitle,
    currentQuestion, totalQuestions, progress, attemptNumber, attemptStartedAt,
    connectedAt, lastSeen, updatedAt }
attempts/{uid}/{lessonId}/{attemptId}: { userName, exerciseTitle, attemptNumber, startedAt,
    finishedAt, correctAnswers, totalQuestions, score, durationMs, status }
userExerciseStats/{uid}/{lessonId}: { userName, exerciseTitle, attemptCount, completedCount,
    lastScore, bestScore, lastAttemptAt }
```

## Cấu hình lần đầu (Firebase Console, project `booming-mission-464623-n0`)

1. **Build → Realtime Database → Create database** (nếu chưa có).
2. **Build → Authentication → Get started → Sign-in method**: bật **Anonymous** và **Email/Password**.
3. **Authentication → Users → Add user**: tạo tài khoản admin (email + mật khẩu). Copy **User UID**.
4. **Realtime Database → Data**: thêm node `admins` → con `<User UID>` = `true` (kiểu boolean).
5. **Project settings → Your apps → Web app** → copy config vào `.env.local`
   (xem `.env.example`). Điền thêm `NEXT_PUBLIC_ADMIN_USERNAME` (tên đăng nhập muốn gõ)
   và `NEXT_PUBLIC_ADMIN_EMAIL` (email tài khoản ở bước 3). **Không ghi mật khẩu vào bất kỳ file nào.**
6. Deploy rules + hosting (xem Lệnh). Sau đó vào `/admin → Cài đặt → Nạp 4 bài mặc định`.

## Lệnh

```bash
npm install
npm run dev              # chạy local (vinext) — http://localhost:3000
npm test                 # build + toàn bộ test
npm run lint
npm run typecheck
npm run build            # build vinext
npm run build:firebase   # build SPA cho Firebase Hosting → firebase-dist/

# Deploy (chỉ khi đã sẵn sàng):
NEXT_PUBLIC_SITE_URL=https://khanhquan.lol npm run build:firebase
firebase deploy --only database,hosting
```

## Bảo mật — giới hạn còn lại

- Chấm điểm diễn ra trên trình duyệt: học viên rành kỹ thuật có thể tự ghi điểm giả cho **chính mình**
  (rules chỉ chặn ghi vào dữ liệu người khác, sai kiểu, sai trình tự trạng thái, attemptCount nhảy cóc).
- Đáp án nằm trong dữ liệu bài học mà học viên đọc được.
- Học viên đọc được danh sách presence (tên, bài đang làm, tiến độ) và uid ẩn danh của nhau.
- Anonymous Auth không giới hạn số tài khoản; nên bật **Firebase App Check** để chặn client lạ.
- Mỗi trình duyệt là một học viên; xoá dữ liệu trình duyệt = học viên mới.

---

# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution
policy blocks `npm.ps1`.

## Public Site URL

Absolute metadata URLs are configured with `NEXT_PUBLIC_SITE_URL`. Copy
`.env.example` to an ignored local environment file for development. The safe
default is `http://localhost:3000`; set the variable to the final HTTPS origin
in the production environment when deploying. Do not commit credentials to an
environment file.

The optional Firebase build reads the same variable, so changing the deployment
origin does not require editing `firebase-site/index.html`.

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
