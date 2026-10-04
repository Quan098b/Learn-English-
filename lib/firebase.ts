import type { Auth, User } from "firebase/auth";
import type { Database } from "firebase/database";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain?: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
};

/**
 * `process.env.NEXT_PUBLIC_*` is replaced with a literal at build time
 * (vinext and firebase.vite.config.ts). When a variable is not set the
 * expression survives and would throw in the browser, hence the try/catch.
 */
function readEnv(read: () => string | undefined): string | undefined {
  try {
    const value = read();
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function readFirebaseConfig(): FirebaseWebConfig | null {
  const config = {
    apiKey: readEnv(() => process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: readEnv(() => process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    databaseURL: readEnv(() => process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
    projectId: readEnv(() => process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: readEnv(() => process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: readEnv(
      () => process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: readEnv(() => process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
  const { apiKey, databaseURL, projectId, appId } = config;
  if (!apiKey || !databaseURL || !projectId || !appId) return null;
  if (!databaseURL.startsWith("https://")) return null;
  return { ...config, apiKey, databaseURL, projectId, appId };
}

/** Public (non-secret) admin login mapping: username → Firebase account email. */
export function readAdminLoginConfig(): { username?: string; email?: string } {
  return {
    username: readEnv(() => process.env.NEXT_PUBLIC_ADMIN_USERNAME),
    email: readEnv(() => process.env.NEXT_PUBLIC_ADMIN_EMAIL),
  };
}

export type FirebaseClient = {
  db: Database;
  auth: Auth;
  dbSdk: typeof import("firebase/database");
  authSdk: typeof import("firebase/auth");
};

/**
 * "student" and "admin" are separate Firebase app instances, so each has its
 * own auth state: an admin signing in never replaces the anonymous student
 * identity in other tabs, and the admin session ends with the browser tab.
 */
export type FirebaseKind = "student" | "admin";

const clients = new Map<FirebaseKind, Promise<FirebaseClient | null>>();

/**
 * Lazily loads the Firebase SDK in the browser only, so server rendering and
 * the initial bundle stay free of it. Resolves to null when not configured.
 */
export function getFirebase(kind: FirebaseKind): Promise<FirebaseClient | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  let promise = clients.get(kind);
  if (!promise) {
    promise = (async () => {
      const config = readFirebaseConfig();
      if (!config) return null;
      const [appSdk, authSdk, dbSdk] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/database"),
      ]);
      const name = kind === "admin" ? "admin" : "[DEFAULT]";
      const app =
        appSdk.getApps().find((a) => a.name === name) ??
        (kind === "admin" ? appSdk.initializeApp(config, "admin") : appSdk.initializeApp(config));
      const auth =
        kind === "admin"
          ? authSdk.initializeAuth(app, { persistence: authSdk.browserSessionPersistence })
          : authSdk.getAuth(app);
      return { db: dbSdk.getDatabase(app), auth, dbSdk, authSdk };
    })().catch((error: unknown) => {
      clients.delete(kind);
      throw error;
    });
    clients.set(kind, promise);
  }
  return promise;
}

function currentUser(client: FirebaseClient): Promise<User | null> {
  return client.auth.authStateReady().then(() => client.auth.currentUser);
}

let studentUserPromise: Promise<{ client: FirebaseClient; user: User } | null> | null = null;

/**
 * Student identity: Firebase Anonymous Authentication. No login screen; the
 * uid is persisted by Firebase in this browser and is the student's userId.
 */
export function getStudentSession(): Promise<{ client: FirebaseClient; user: User } | null> {
  studentUserPromise ??= (async () => {
    const client = await getFirebase("student");
    if (!client) return null;
    const existing = await currentUser(client);
    const user = existing ?? (await client.authSdk.signInAnonymously(client.auth)).user;
    return { client, user };
  })().catch((error: unknown) => {
    studentUserPromise = null;
    throw error;
  });
  return studentUserPromise;
}
