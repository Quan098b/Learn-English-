"use client";

import { useState } from "react";

type SpeechButtonProps = {
  text: string;
  label?: string;
  supported: boolean;
  enabled?: boolean;
  speak: (text: string) => Promise<boolean>;
  size?: "sm" | "lg";
};

const UNSUPPORTED = "Trình duyệt này không hỗ trợ phát âm tự động.";

export function SpeechButton({ text, label = "Nghe", supported, enabled = true, speak, size = "sm" }: SpeechButtonProps) {
  const [playing, setPlaying] = useState(false);
  if (!enabled) return null;
  const disabled = !supported;
  return (
    <button
      type="button"
      className={`speech-btn speech-${size} ${playing ? "is-playing" : ""}`}
      onClick={() => {
        setPlaying(true);
        void speak(text).finally(() => setPlaying(false));
      }}
      disabled={disabled}
      title={disabled ? UNSUPPORTED : `Phát âm: ${text}`}
      aria-label={disabled ? `${label} (${UNSUPPORTED})` : `${label}: phát âm`}
    >
      <span aria-hidden="true">🔊</span>
      <span>{label}</span>
    </button>
  );
}
