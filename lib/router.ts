/**
 * Tiny client-side router. Works the same in the Firebase Hosting SPA (every
 * path rewrites to index.html) and in vinext (app/[[...slug]]/page.tsx).
 */

export type Route =
  | { name: "home" }
  | { name: "learn"; lessonId: string }
  | { name: "exercise"; lessonId: string }
  | { name: "admin-dashboard" }
  | { name: "admin-users" }
  | { name: "admin-user"; userId: string }
  | { name: "admin-exercises" }
  | { name: "admin-exercise-new" }
  | { name: "admin-exercise"; lessonId: string }
  | { name: "admin-exercise-edit"; lessonId: string }
  | { name: "admin-exercise-preview"; lessonId: string }
  | { name: "admin-attempts" }
  | { name: "admin-import" }
  | { name: "admin-settings" }
  | { name: "not-found" };

const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;

export function parseRoute(pathname: string): Route {
  const parts = pathname
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return "";
      }
    });
  const [a, b, c, d] = parts;
  const ok = (value: string | undefined): value is string => !!value && SEGMENT.test(value);

  if (parts.length === 0) return { name: "home" };
  if (a === "learn" && ok(b) && parts.length === 2) return { name: "learn", lessonId: b };
  if (a === "exercise" && ok(b) && parts.length === 2) return { name: "exercise", lessonId: b };
  if (a !== "admin") return { name: "not-found" };

  if (parts.length === 1) return { name: "admin-dashboard" };
  if (b === "users" && parts.length === 2) return { name: "admin-users" };
  if (b === "users" && ok(c) && parts.length === 3) return { name: "admin-user", userId: c };
  if (b === "exercises" && parts.length === 2) return { name: "admin-exercises" };
  if (b === "exercises" && c === "new" && parts.length === 3) return { name: "admin-exercise-new" };
  if (b === "exercises" && ok(c) && parts.length === 3) return { name: "admin-exercise", lessonId: c };
  if (b === "exercises" && ok(c) && d === "edit" && parts.length === 4) return { name: "admin-exercise-edit", lessonId: c };
  if (b === "exercises" && ok(c) && d === "preview" && parts.length === 4) return { name: "admin-exercise-preview", lessonId: c };
  if (b === "attempts" && parts.length === 2) return { name: "admin-attempts" };
  if (b === "import" && parts.length === 2) return { name: "admin-import" };
  if (b === "settings" && parts.length === 2) return { name: "admin-settings" };
  return { name: "not-found" };
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

const listeners = new Set<() => void>();

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (typeof window === "undefined") return;
  if (to === window.location.pathname) return;
  if (options.replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.scrollTo({ top: 0 });
  for (const listener of listeners) listener();
}

export function subscribePath(listener: () => void) {
  listeners.add(listener);
  const onPop = () => listener();
  window.addEventListener("popstate", onPop);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", onPop);
  };
}

export function getPath(): string {
  return window.location.pathname;
}
