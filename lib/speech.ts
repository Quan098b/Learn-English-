/**
 * English pronunciation with the browser's Web Speech API
 * (window.speechSynthesis + SpeechSynthesisUtterance). No audio files.
 */

export type SpeakOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export const DEFAULT_LANGUAGE = "en-US";
export const DEFAULT_RATE = 0.85;

type VoiceLike = Pick<SpeechSynthesisVoice, "lang" | "name" | "localService" | "default">;

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

function normalizeLang(lang: string): string {
  return lang.replace("_", "-").toLowerCase();
}

/**
 * Picks the best voice for `language`: exact locale first (en-US / en-GB),
 * then any English voice. Within a group, prefer higher-quality voices
 * ("Natural", "Google", "Online") and then local ones. Pure — unit tested.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], language: string): T | null {
  const target = normalizeLang(language);
  const quality = (voice: T) =>
    (/natural|neural|online|google|premium|enhanced/i.test(voice.name) ? 2 : 0) +
    (voice.localService ? 1 : 0);
  const best = (list: T[]) => [...list].sort((a, b) => quality(b) - quality(a))[0] ?? null;

  const exact = voices.filter((v) => normalizeLang(v.lang) === target);
  if (exact.length) return best(exact);
  const english = voices.filter((v) => normalizeLang(v.lang).startsWith("en"));
  return english.length ? best(english) : null;
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Voices load asynchronously in Chrome; wait for `voiceschanged` (max 1.5 s). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesPromise ??= new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, 1500);
  });
  return voicesPromise;
}

/**
 * Speaks English text. Cancels anything currently playing so rapid clicks
 * don't queue up. Resolves when finished; never throws.
 */
export async function speakEnglish(text: string, options: SpeakOptions = {}): Promise<boolean> {
  const content = text.trim();
  if (!content || !isSpeechSupported()) return false;
  try {
    const language = options.language ?? DEFAULT_LANGUAGE;
    const voices = await loadVoices();
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = language;
    const voice = pickVoice(voices, language);
    if (voice) utterance.voice = voice;
    utterance.rate = options.rate ?? DEFAULT_RATE;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;
    return await new Promise<boolean>((resolve) => {
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      synth.speak(utterance);
    });
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
