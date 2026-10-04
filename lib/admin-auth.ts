import type { User } from "firebase/auth";
import { getFirebase, readAdminLoginConfig } from "./firebase.ts";

/**
 * Admin authentication = Firebase Authentication (Email/Password) on a
 * separate "admin" Firebase app instance with session persistence.
 *
 * - The password is checked by Firebase Auth only. It never appears in the
 *   source, the bundle, env files, localStorage or the database.
 * - The login form asks for a username; it is mapped to the Firebase account
 *   email through the public env vars NEXT_PUBLIC_ADMIN_USERNAME/EMAIL (or the
 *   admin can type the email directly).
 * - Being signed in is not enough: the account's uid must be listed at
 *   `admins/{uid} = true` (set by hand in the Firebase console). Security
 *   rules enforce the same check for every admin read/write.
 */

export type AdminUser = { uid: string; email: string | null };

export type AdminAuthState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "signed-out" }
  | { status: "not-admin"; user: AdminUser }
  | { status: "admin"; user: AdminUser };

export function resolveAdminEmail(username: string): string | null {
  const input = username.trim();
  if (!input) return null;
  if (input.includes("@")) return input;
  const config = readAdminLoginConfig();
  if (config.username && config.email && input.toLowerCase() === config.username.toLowerCase()) {
    return config.email;
  }
  return null;
}

const GENERIC_ERROR = "Sai tên đăng nhập hoặc mật khẩu.";

export function loginErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "auth/too-many-requests") return "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.";
  if (code === "auth/network-request-failed") return "Không có kết nối mạng.";
  if (code === "auth/operation-not-allowed") return "Chưa bật đăng nhập Email/Password trong Firebase Authentication.";
  return GENERIC_ERROR;
}

export async function adminSignIn(username: string, password: string): Promise<void> {
  const client = await getFirebase("admin");
  if (!client) throw new Error("Firebase chưa được cấu hình.");
  const email = resolveAdminEmail(username);
  if (!email || !password) throw Object.assign(new Error(GENERIC_ERROR), { code: "auth/invalid-credential" });
  await client.authSdk.signInWithEmailAndPassword(client.auth, email, password);
}

export async function adminSignOut(): Promise<void> {
  const client = await getFirebase("admin");
  if (client) await client.authSdk.signOut(client.auth);
}

async function isAdmin(user: User): Promise<boolean> {
  const client = await getFirebase("admin");
  if (!client) return false;
  const { db, dbSdk: fb } = client;
  try {
    const snapshot = await fb.get(fb.ref(db, `admins/${user.uid}`));
    return snapshot.val() === true;
  } catch {
    return false;
  }
}

/** Watches the admin auth state; returns an unsubscribe function. */
export function watchAdminAuth(onState: (state: AdminAuthState) => void): () => void {
  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  void getFirebase("admin")
    .then((client) => {
      if (disposed) return;
      if (!client) {
        onState({ status: "disabled" });
        return;
      }
      unsubscribe = client.authSdk.onAuthStateChanged(client.auth, (user) => {
        if (!user) {
          onState({ status: "signed-out" });
          return;
        }
        onState({ status: "loading" });
        void isAdmin(user).then((admin) => {
          if (disposed) return;
          const info = { uid: user.uid, email: user.email };
          onState(admin ? { status: "admin", user: info } : { status: "not-admin", user: info });
        });
      });
    })
    .catch(() => {
      if (!disposed) onState({ status: "disabled" });
    });
  return () => {
    disposed = true;
    unsubscribe?.();
  };
}
