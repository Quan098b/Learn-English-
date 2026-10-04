"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { usePresence } from "../../hooks/usePresence";
import { defaultLessons } from "../../lib/default-lessons";
import {
  getIdentitySnapshot,
  getServerIdentitySnapshot,
  getSessionId,
  saveName,
  subscribeIdentity,
} from "../../lib/identity";
import type { Lesson } from "../../lib/lesson-schema";
import { subscribePublishedLessons } from "../../lib/lessons";
import type { ConnectionStatus } from "../../lib/presence";
import type { Activity } from "../../lib/presence-model";
import { getResultsSnapshot, getServerResultsSnapshot, subscribeResults } from "../../lib/results";
import { navigate, type Route } from "../../lib/router";
import { Link } from "../shared/Link";
import { NameModal } from "../shared/NameModal";
import { ExerciseSession } from "./ExerciseSession";
import { LearnPage } from "./LearnPage";
import { LessonCard } from "./LessonCard";
import { OnlineUsers } from "./OnlineUsers";
import { SettingsDialog } from "./SettingsDialog";
import { StudentHeader } from "./StudentHeader";

const VIEWING: Activity = { state: "viewing" };
const noopSubscribe = () => () => {};

type StudentRoute = Extract<Route, { name: "home" | "learn" | "exercise" | "not-found" }>;

/**
 * Published lessons from Firebase. Without Firebase configuration the bundled
 * default lessons are shown so the site still works locally.
 */
function usePublishedLessons() {
  const [state, setState] = useState<{ lessons: Lesson[]; status: ConnectionStatus }>({
    lessons: [],
    status: "connecting",
  });
  useEffect(
    () =>
      subscribePublishedLessons(
        (lessons) => setState({ lessons, status: "online" }),
        (status) =>
          setState((prev) => ({
            lessons: status === "disabled" ? defaultLessons : prev.lessons,
            status,
          })),
      ),
    [],
  );
  return state;
}

export function StudentApp({ route }: { route: StudentRoute }) {
  const identity = useSyncExternalStore(subscribeIdentity, getIdentitySnapshot, getServerIdentitySnapshot);
  const results = useSyncExternalStore(subscribeResults, getResultsSnapshot, getServerResultsSnapshot);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [renaming, setRenaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activity, setActivity] = useState<Activity>(VIEWING);

  const sessionId = mounted ? getSessionId() : "";
  const presenceStatus = usePresence(sessionId, identity?.name ?? null, activity);
  const { users, summary, status: listStatus } = useOnlineUsers("student", identity?.userId ?? null);
  const status = identity ? presenceStatus : listStatus;
  const { lessons, status: lessonsStatus } = usePublishedLessons();

  const onActivity = useCallback((next: Activity) => setActivity(next), []);
  const goHome = useCallback(() => navigate("/"), []);

  const lessonId = route.name === "learn" || route.name === "exercise" ? route.lessonId : null;
  const lesson = lessonId ? lessons.find((l) => l.id === lessonId) : undefined;
  const lessonsLoading = lessonsStatus === "connecting" && lessons.length === 0;
  const showNameModal = mounted && (!identity || renaming);

  let content;
  if (route.name === "home") {
    content = (
      <>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">
            {identity ? <>Xin chào, {identity.name} <span aria-hidden="true">👋</span></> : "Học tiếng Anh cùng nhau"}
          </h1>
          <p>Hôm nay cùng luyện tiếng Anh nhé.</p>
        </section>
        <div className="home-grid">
          <OnlineUsers users={users} summary={summary} status={status} />
          <section className="exercises" aria-labelledby="lessons-title">
            <h2 id="lessons-title">Bài học</h2>
            {lessonsLoading && <p className="panel-notice">Đang tải bài học…</p>}
            {lessonsStatus === "error" && lessons.length === 0 && (
              <p className="panel-notice">Không tải được bài học. Hãy thử tải lại trang.</p>
            )}
            {lessonsStatus === "online" && lessons.length === 0 && (
              <p className="panel-notice">Chưa có bài học nào được công khai.</p>
            )}
            <ul className="lesson-grid">
              {lessons.map((item, index) => (
                <LessonCard key={item.id} lesson={item} index={index} lastResult={results[item.id]} />
              ))}
            </ul>
          </section>
        </div>
      </>
    );
  } else if (lessonId && !lesson) {
    content = lessonsLoading ? (
      <p className="panel-notice">Đang tải bài học…</p>
    ) : (
      <div className="empty">
        <h1>Không tìm thấy bài học</h1>
        <p className="muted">Bài này không tồn tại hoặc đã bị ẩn.</p>
        <Link className="btn btn-primary" href="/">Về trang chủ</Link>
      </div>
    );
  } else if (route.name === "learn" && lesson) {
    content = <LearnPage lesson={lesson} />;
  } else if (route.name === "exercise" && lesson) {
    content = mounted ? (
      <ExerciseSession
        key={lesson.id}
        lesson={lesson}
        userName={identity?.name ?? null}
        onActivity={onActivity}
        onExit={goHome}
      />
    ) : null;
  } else {
    content = (
      <div className="empty">
        <h1>Không tìm thấy trang</h1>
        <Link className="btn btn-primary" href="/">Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-shell" inert={showNameModal || settingsOpen || undefined}>
        <a className="skip-link" href="#main">Bỏ qua đến nội dung</a>
        <StudentHeader
          name={identity?.name ?? null}
          onlineCount={summary.online}
          status={status}
          onRename={() => setRenaming(true)}
          onSettings={() => setSettingsOpen(true)}
        />
        <main id="main" className="container">{content}</main>
        <footer className="site-footer">
          <p>English Practice · Luyện từ vựng, phiên âm IPA và bài tập tiếng Anh.</p>
        </footer>
      </div>

      {showNameModal && (
        <NameModal
          initialName={renaming ? identity?.name : ""}
          onSubmit={(name) => {
            saveName(name);
            setRenaming(false);
          }}
          onCancel={identity ? () => setRenaming(false) : undefined}
        />
      )}
      {settingsOpen && !showNameModal && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
