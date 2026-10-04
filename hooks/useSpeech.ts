"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getServerSettingsSnapshot,
  getSettingsSnapshot,
  speechLanguage,
  subscribeSettings,
} from "../lib/settings";
import { DEFAULT_RATE, isSpeechSupported, speakEnglish } from "../lib/speech";
import type { LessonAudio } from "../lib/lesson-schema";

const noopSubscribe = () => () => {};

export function useSettings() {
  return useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getServerSettingsSnapshot);
}

/**
 * Speech for one lesson: the learner's accent unless the lesson sets
 * `audio.language`; `audio.enabled: false` turns the buttons off.
 */
export function useSpeech(audio?: LessonAudio) {
  const settings = useSettings();
  // false during SSR/hydration, real value afterwards.
  const supported = useSyncExternalStore(noopSubscribe, isSpeechSupported, () => false);
  const enabled = audio?.enabled !== false;
  const language = speechLanguage(settings, audio?.language);
  const rate = audio?.rate ?? DEFAULT_RATE;

  const speak = useCallback(
    (text: string) => speakEnglish(text, { language, rate, pitch: 1, volume: 1 }),
    [language, rate],
  );

  return { supported, enabled, speak, language, autoPlay: settings.autoPlay };
}
