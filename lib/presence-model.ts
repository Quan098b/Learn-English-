/**
 * Pure presence helpers shared by the Firebase client, the student page and
 * the admin dashboard. Nothing here touches Firebase, so it is unit-tested.
 *
 * Database shape: presenceSessions/{userId}/{sessionId} = PresenceSession.
 * A user is online when at least one of their sessions is online.
 */

export const NAME_MAX_LENGTH = 30;
export const EXERCISE_ID_MAX_LENGTH = 64;
export const EXERCISE_TITLE_MAX_LENGTH = 120;
export const MAX_QUESTIONS = 200;

/** How often a connected tab refreshes `lastSeen`. */
export const HEARTBEAT_INTERVAL_MS = 60_000;
/**
 * Sessions whose `lastSeen` is older than this are treated as gone even if
 * the node still exists (e.g. onDisconnect has not fired yet). Background
 * tabs may throttle timers to once a minute, so keep a safe margin.
 */
export const STALE_AFTER_MS = 3 * 60_000;

/** Firebase auth uids and our session ids. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

export type PresenceState = "viewing" | "doing";

export type Activity =
  | { state: "viewing" }
  | {
      state: "doing";
      exerciseId: string;
      exerciseTitle: string;
      currentQuestion: number;
      totalQuestions: number;
      progress: number;
      attemptNumber: number;
      attemptStartedAt: number;
    };

/** One browser tab, as stored (timestamps resolved). */
export type PresenceSession = {
  userId: string;
  sessionId: string;
  name: string;
  online: true;
  state: PresenceState;
  exerciseId: string | null;
  exerciseTitle: string | null;
  currentQuestion: number;
  totalQuestions: number;
  progress: number;
  attemptNumber: number;
  attemptStartedAt: number | null;
  connectedAt: number;
  lastSeen: number;
  updatedAt: number;
};

/** A person, aggregated over all their open tabs. */
export type OnlineUser = Omit<PresenceSession, "sessionId"> & {
  sessionCount: number;
  isSelf: boolean;
};

// Control, invisible formatting (zero-width, bidi overrides) and line separators.
const CONTROL_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Trims, strips control characters, collapses spaces and caps length. */
export function sanitizeName(input: unknown): string {
  if (typeof input !== "string") return "";
  const cleaned = input.replace(/\s+/g, " ").replace(CONTROL_CHARS, "").trim();
  // Cap by UTF-16 length (what the database rules measure) without
  // splitting an emoji or other surrogate pair in half.
  let result = "";
  for (const char of cleaned) {
    if (result.length + char.length > NAME_MAX_LENGTH) break;
    result += char;
  }
  return result.trim();
}

function clampInt(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(CONTROL_CHARS, "").trim().slice(0, maxLength);
  return text.length > 0 ? text : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const VIEWING_FIELDS = {
  state: "viewing" as const,
  exerciseId: null,
  exerciseTitle: null,
  currentQuestion: 0,
  totalQuestions: 0,
  progress: 0,
  attemptNumber: 0,
  attemptStartedAt: null,
};

/** Activity fields exactly as they are written to the database. */
export function activityFields(activity: Activity) {
  if (activity.state === "viewing") return { ...VIEWING_FIELDS };
  const totalQuestions = clampInt(activity.totalQuestions, 1, MAX_QUESTIONS);
  return {
    state: "doing" as const,
    exerciseId: cleanText(activity.exerciseId, EXERCISE_ID_MAX_LENGTH),
    exerciseTitle: cleanText(activity.exerciseTitle, EXERCISE_TITLE_MAX_LENGTH),
    currentQuestion: clampInt(activity.currentQuestion, 0, totalQuestions),
    totalQuestions,
    progress: clampInt(activity.progress, 0, 100),
    attemptNumber: clampInt(activity.attemptNumber, 0, 1_000_000),
    attemptStartedAt: finiteNumber(activity.attemptStartedAt),
  };
}

/** Validates one raw session node; returns null for anything malformed. */
export function parsePresenceSession(
  userId: string,
  sessionId: string,
  raw: unknown,
): PresenceSession | null {
  if (!ID_PATTERN.test(userId) || !ID_PATTERN.test(sessionId)) return null;
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const name = sanitizeName(data.name);
  const lastSeen = finiteNumber(data.lastSeen);
  if (!name || data.online !== true || lastSeen === null) return null;

  const base = {
    userId,
    sessionId,
    name,
    online: true as const,
    connectedAt: finiteNumber(data.connectedAt) ?? lastSeen,
    lastSeen,
    updatedAt: finiteNumber(data.updatedAt) ?? lastSeen,
  };

  const exerciseId = cleanText(data.exerciseId, EXERCISE_ID_MAX_LENGTH);
  const exerciseTitle = cleanText(data.exerciseTitle, EXERCISE_TITLE_MAX_LENGTH);
  if (data.state === "doing" && exerciseId && exerciseTitle) {
    const totalQuestions = clampInt(data.totalQuestions, 1, MAX_QUESTIONS);
    return {
      ...base,
      state: "doing",
      exerciseId,
      exerciseTitle,
      currentQuestion: clampInt(data.currentQuestion, 0, totalQuestions),
      totalQuestions,
      progress: clampInt(data.progress, 0, 100),
      attemptNumber: clampInt(data.attemptNumber, 0, 1_000_000),
      attemptStartedAt: finiteNumber(data.attemptStartedAt),
    };
  }
  return { ...base, ...VIEWING_FIELDS };
}

/** Flattens `presenceSessions` into live (non-stale, valid) sessions. */
export function liveSessions(snapshot: unknown, serverNow: number): PresenceSession[] {
  if (typeof snapshot !== "object" || snapshot === null) return [];
  const sessions: PresenceSession[] = [];
  for (const [userId, perUser] of Object.entries(snapshot)) {
    if (typeof perUser !== "object" || perUser === null) continue;
    for (const [sessionId, raw] of Object.entries(perUser)) {
      const session = parsePresenceSession(userId, sessionId, raw);
      if (session && serverNow - session.lastSeen <= STALE_AFTER_MS) sessions.push(session);
    }
  }
  return sessions;
}

const rank = (s: Pick<PresenceSession, "state">) => (s.state === "doing" ? 1 : 0);

/**
 * One entry per user: a tab that is doing an exercise wins over viewing tabs,
 * and among equals the most recently updated tab wins. Sorted: current user,
 * then people doing exercises, then by name.
 */
export function aggregateOnlineUsers(
  sessions: readonly PresenceSession[],
  selfUserId: string | null,
): OnlineUser[] {
  const byUser = new Map<string, { best: PresenceSession; count: number; lastSeen: number; connectedAt: number }>();
  for (const session of sessions) {
    const entry = byUser.get(session.userId);
    if (!entry) {
      byUser.set(session.userId, {
        best: session,
        count: 1,
        lastSeen: session.lastSeen,
        connectedAt: session.connectedAt,
      });
      continue;
    }
    entry.count += 1;
    entry.lastSeen = Math.max(entry.lastSeen, session.lastSeen);
    entry.connectedAt = Math.min(entry.connectedAt, session.connectedAt);
    if (
      rank(session) > rank(entry.best) ||
      (rank(session) === rank(entry.best) && session.updatedAt > entry.best.updatedAt)
    ) {
      entry.best = session;
    }
  }

  return [...byUser.values()]
    .map(({ best, count, lastSeen, connectedAt }) => {
      const { sessionId: _sessionId, ...rest } = best;
      void _sessionId;
      return { ...rest, lastSeen, connectedAt, sessionCount: count, isSelf: best.userId === selfUserId };
    })
    .sort(
      (a, b) =>
        Number(b.isSelf) - Number(a.isSelf) ||
        rank(b) - rank(a) ||
        a.name.localeCompare(b.name, "vi"),
    );
}

export function buildOnlineUsers(snapshot: unknown, serverNow: number, selfUserId: string | null) {
  return aggregateOnlineUsers(liveSessions(snapshot, serverNow), selfUserId);
}

export function summarizeUsers(users: readonly Pick<OnlineUser, "state">[]) {
  return {
    online: users.length,
    doing: users.filter((user) => user.state === "doing").length,
  };
}
