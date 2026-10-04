"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type ConfirmDialogProps = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** When set, the user must type this word before confirming. */
  requireText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  requireText,
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const inputId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (inputRef.current ?? cancelRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canConfirm = !busy && (!requireText || typed.trim() === requireText);

  return (
    <div className="modal-backdrop">
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <div className="modal-body">{children}</div>
        {requireText && (
          <div className="field">
            <label htmlFor={inputId}>
              Nhập <strong>{requireText}</strong> để xác nhận
            </label>
            <input
              id={inputId}
              ref={inputRef}
              className="text-input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        <div className="modal-actions">
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel}>
            Hủy
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
