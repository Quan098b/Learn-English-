"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { adminSignIn, loginErrorMessage } from "../../lib/admin-auth";
import { Link } from "../shared/Link";

/**
 * Username + password form. The password goes straight to Firebase
 * Authentication and is never stored by this app.
 */
export function AdminLogin({ notice }: { notice?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const userId = useId();
  const passId = useId();
  const errorId = useId();

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await adminSignIn(username, password);
      setPassword("");
    } catch (err) {
      setError(loginErrorMessage(err));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit} noValidate aria-describedby={error ? errorId : undefined}>
        <p className="brand login-brand">
          <span className="brand-mark" aria-hidden="true">Aa</span>
          <span>English Practice</span>
        </p>
        <h1>Đăng nhập quản trị</h1>
        {notice && <p className="panel-notice">{notice}</p>}
        <div className="field">
          <label htmlFor={userId}>Tên đăng nhập</label>
          <input
            id={userId}
            ref={userRef}
            className="text-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={passId}>Mật khẩu</label>
          <input
            id={passId}
            type="password"
            className="text-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="form-error" id={errorId} role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !username || !password}>
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
        <Link className="muted small center" href="/">← Về trang học</Link>
      </form>
    </main>
  );
}
