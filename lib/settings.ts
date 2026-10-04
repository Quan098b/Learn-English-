/** Learner preferences, stored per browser in localStorage. */

export type Accent = "US" | "UK";

export type LearnerSettings = {
  accent: Accent;
  /** Speak the word automatically when a new question appears. Default OFF. */
  autoPlay: boolean;
};

const KEY = "englishPractice.settings";
export const DEFAULT_SETTINGS: LearnerSettings = { accent: "US", autoPlay: false };

export const ACCENT_LANGUAGE: Record<Accent, string> = { US: "en-US", UK: "en-GB" };

export function parseSettings(raw: string | null): LearnerSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const data = JSON.parse(raw) as Partial<LearnerSettings>;
    return {
      accent: data.accent === "UK" ? "UK" : "US",
      autoPlay: data.autoPlay === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Lesson `audio.language` overrides the learner's accent when set. */
export function speechLanguage(settings: LearnerSettings, lessonLanguage?: string): string {
  return lessonLanguage ?? ACCENT_LANGUAGE[settings.accent];
}

let cachedRaw: string | null | undefined;
let cached = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getSettingsSnapshot(): LearnerSettings {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseSettings(raw);
  }
  return cached;
}

export const getServerSettingsSnapshot = () => DEFAULT_SETTINGS;

export function updateSettings(patch: Partial<LearnerSettings>) {
  const next = { ...getSettingsSnapshot(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory value when storage is blocked.
  }
  cachedRaw = readRaw();
  cached = next;
  for (const listener of listeners) listener();
}

export function subscribeSettings(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
