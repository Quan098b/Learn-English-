"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { NAME_MAX_LENGTH, sanitizeName } from "../../lib/presence-model";

type NameModalProps = {
  initialName?: string;
  onSubmit: (name: string) => void;
  /** Only provided when renaming; first-time visitors must enter a name. */
  onCancel?: () => void;
};

export function NameModal({ initialName = "", onSubmit, onCancel }: NameModalProps) {
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (!onCancel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = sanitizeName(value);
    if (!name) {
      setError("Vui lòng nhập tên của bạn.");
      inputRef.current?.focus();
      return;
    }
    onSubmit(name);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <form onSubmit={handleSubmit} noValidate>
          <h2 id={titleId}>Bạn tên là gì?</h2>
          <p className="modal-hint">Tên sẽ hiển thị cho các bạn đang học cùng.</p>
          <label className="sr-only" htmlFor="display-name">Tên của bạn</label>
          <input
            id="display-name"
            ref={inputRef}
            className="text-input"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="nickname"
            placeholder="Ví dụ: Quân"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && <p className="form-error" id={errorId} role="alert">{error}</p>}
          <div className="modal-actions">
            {onCancel && (
              <button type="button" className="btn btn-ghost" onClick={onCancel}>Huỷ</button>
            )}
            <button type="submit" className="btn btn-primary">
              {onCancel ? "Lưu tên" : "Bắt đầu học"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
