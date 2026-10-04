import type { ScoreSummary } from "./scoring.ts";

const RESULTS_KEY = "englishPractice.lastResults";

export type LastResult = ScoreSummary & { finishedAt: number };
export type LastResults = Record<string, LastResult>;

const EMPTY: LastResults = {};
let cachedRaw: string | null = null;
let cached: LastResults = EMPTY;
const listeners = new Set<() => void>();

function isResult(value: unknown): value is LastResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return ["correct", "total", "percent", "finishedAt"].every(
    (key) => typeof v[key] === "number" && Number.isFinite(v[key]),
  );
}

export function parseResults(raw: string | null): LastResults {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return EMPTY;
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => isResult(value)),
    ) as LastResults;
  } catch {
    return EMPTY;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(RESULTS_KEY);
  } catch {
    return null;
  }
}

export function getResultsSnapshot(): LastResults {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseResults(raw);
  }
  return cached;
}

export const getServerResultsSnapshot = (): LastResults => EMPTY;

export function saveResult(exerciseId: string, score: ScoreSummary) {
  const next = {
    ...getResultsSnapshot(),
    [exerciseId]: { ...score, finishedAt: Date.now() },
  };
  try {
    window.localStorage.setItem(RESULTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore: results are a convenience only.
  }
  for (const listener of listeners) listener();
}

export function subscribeResults(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
