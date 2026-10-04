"use client";

import { useEffect, useId, useRef } from "react";
import { useSettings } from "../../hooks/useSpeech";
import { ACCENT_LANGUAGE, SPEED_LABELS, speechRate, updateSettings, type Accent, type Speed } from "../../lib/settings";
import { isSpeechSupported, speakEnglish } from "../../lib/speech";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chooseAccent = (accent: Accent) => {
    updateSettings({ accent });
    void speakEnglish("Hello, nice to meet you.", { language: ACCENT_LANGUAGE[accent] });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Cài đặt</h2>
        <fieldset className="field">
          <legend>Giọng tiếng Anh</legend>
          <div className="segmented">
            {(["US", "UK"] as const).map((accent) => (
              <label key={accent} className={settings.accent === accent ? "is-active" : ""}>
                <input
                  type="radio"
                  name="accent"
                  value={accent}
                  checked={settings.accent === accent}
                  onChange={() => chooseAccent(accent)}
                />
                {accent === "US" ? "Mỹ (US)" : "Anh (UK)"}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Tốc độ đọc</legend>
          <div className="segmented">
            {(["slow", "normal", "fast"] as const).map((speed: Speed) => (
              <label key={speed} className={settings.speed === speed ? "is-active" : ""}>
                <input
                  type="radio"
                  name="speed"
                  value={speed}
                  checked={settings.speed === speed}
                  onChange={() => {
                    const next = { ...settings, speed };
                    updateSettings({ speed });
                    void speakEnglish("She is my friend.", { language: ACCENT_LANGUAGE[settings.accent], rate: speechRate(next) });
                  }}
                />
                {SPEED_LABELS[speed]}
              </label>
            ))}
          </div>
          <p className="muted small">Mới học nên chọn Chậm.</p>
        </fieldset>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.autoPlay}
            onChange={(event) => updateSettings({ autoPlay: event.target.checked })}
          />
          <span>Tự phát âm khi sang câu mới</span>
        </label>
        {!isSpeechSupported() && (
          <p className="panel-notice">Trình duyệt này không hỗ trợ phát âm tự động.</p>
        )}
        <p className="muted small">Một số bài có thể dùng giọng riêng do giáo viên cài đặt.</p>
        <div className="modal-actions">
          <button ref={closeRef} type="button" className="btn btn-primary" onClick={onClose}>Xong</button>
        </div>
      </div>
    </div>
  );
}
