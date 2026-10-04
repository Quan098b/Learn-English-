"use client";

import { useEffect, useId, useRef } from "react";
import { useSettings } from "../../hooks/useSpeech";
import { ACCENT_LANGUAGE, updateSettings, type Accent } from "../../lib/settings";
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
