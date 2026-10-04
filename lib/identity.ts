import { ID_PATTERN, sanitizeName } from "./presence-model.ts";

const NAME_KEY = "englishPractice.displayName";
const USER_ID_KEY = "englishPractice.userId";
const LEGACY_NAME_KEY = "english-practice:name";

export type Identity = {
  /** Firebase anonymous-auth uid; null until signed in (or when Firebase is off). */
  userId: string | null;
  sessionId: string;
  name: string;
};

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One id per page load (not sessionStorage): duplicated tabs copy
 * sessionStorage, which would make two tabs share one presence node.
 */
const sessionId = typeof window === "undefined" ? "" : `s_${randomId()}`;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): identity still works for this page load.
  }
}

let memoryName: string | null = null;
let memoryUserId: string | null = null;
let cached: Identity | null = null;
const listeners = new Set<() => void>();

function readName(): string {
  const stored = safeGet(NAME_KEY);
  if (stored === null) {
    const legacy = sanitizeName(safeGet(LEGACY_NAME_KEY));
    if (legacy) {
      safeSet(NAME_KEY, legacy);
      return legacy;
    }
  }
  return sanitizeName(stored ?? memoryName ?? "");
}

function readIdentity(): Identity | null {
  const name = readName();
  if (!name) return null;
  const stored = safeGet(USER_ID_KEY);
  const userId = memoryUserId ?? (stored && ID_PATTERN.test(stored) ? stored : null);
  if (cached?.name !== name || cached.userId !== userId) {
    cached = { userId, sessionId, name };
  }
  return cached;
}

function notify() {
  for (const listener of listeners) listener();
}

export function saveName(input: string): boolean {
  const name = sanitizeName(input);
  if (!name) return false;
  memoryName = name;
  safeSet(NAME_KEY, name);
  notify();
  return true;
}

/** Called once anonymous auth resolves; the uid is the student's userId. */
export function setUserId(uid: string) {
  if (!ID_PATTERN.test(uid) || memoryUserId === uid) return;
  memoryUserId = uid;
  safeSet(USER_ID_KEY, uid);
  notify();
}

export function getSessionId(): string {
  return sessionId;
}

// useSyncExternalStore plumbing.
export function subscribeIdentity(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === NAME_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getIdentitySnapshot = readIdentity;
export const getServerIdentitySnapshot = (): Identity | null => null;
