import type { DatabaseReference, Unsubscribe } from "firebase/database";
import { getFirebase, getStudentSession, type FirebaseClient, type FirebaseKind } from "./firebase.ts";
import { activityFields, HEARTBEAT_INTERVAL_MS, type Activity } from "./presence-model.ts";

export const PRESENCE_PATH = "presenceSessions";
export const USERS_PATH = "users";

export type ConnectionStatus = "connecting" | "online" | "offline" | "disabled" | "error";

export type PresenceHandle = {
  setActivity(activity: Activity): void;
  setName(name: string): void;
  stop(): void;
};

type Fields = ReturnType<typeof activityFields> & { name: string };

/**
 * Publishes this tab at `presenceSessions/{uid}/{sessionId}` using Firebase's
 * own connection tracking:
 *  - `.info/connected` tells us when the socket is (re)established;
 *  - each time, `onDisconnect().remove()` is registered on the server first
 *    and then the full record is written, so a closed tab or a lost network
 *    removes only this tab's node — other tabs of the same user stay online;
 *  - activity changes send only the fields that changed;
 *  - a slow heartbeat refreshes `lastSeen` so readers can hide sessions whose
 *    onDisconnect has not fired yet (see STALE_AFTER_MS).
 * The user's public profile `users/{uid}` (name, lastActiveAt) is updated too.
 */
export function startPresence(
  sessionId: string,
  name: string,
  initialActivity: Activity,
  onStatus: (status: ConnectionStatus) => void,
  onUserId: (uid: string) => void,
): PresenceHandle {
  let disposed = false;
  let connected = false;
  let current: Fields = { name, ...activityFields(initialActivity) };
  let node: DatabaseReference | null = null;
  let client: FirebaseClient | null = null;
  let userRef: DatabaseReference | null = null;
  let unsubscribeConnected: Unsubscribe | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const fail = (error: unknown) => {
    if (disposed) return;
    console.warn("[presence]", error);
    onStatus("error");
  };

  void getStudentSession()
    .then((session) => {
      if (disposed) return;
      if (!session) {
        onStatus("disabled");
        return;
      }
      client = session.client;
      const uid = session.user.uid;
      onUserId(uid);
      const { db, dbSdk: fb } = session.client;
      const presenceNode = fb.ref(db, `${PRESENCE_PATH}/${uid}/${sessionId}`);
      const profile = fb.ref(db, `${USERS_PATH}/${uid}`);
      node = presenceNode;
      userRef = profile;

      unsubscribeConnected = fb.onValue(
        fb.ref(db, ".info/connected"),
        (snapshot) => {
          if (snapshot.val() !== true) {
            connected = false;
            onStatus("offline");
            return;
          }
          fb.onDisconnect(presenceNode)
            .remove()
            .then(() => {
              if (disposed) return;
              return Promise.all([
                fb.set(presenceNode, {
                  online: true,
                  ...current,
                  connectedAt: fb.serverTimestamp(),
                  lastSeen: fb.serverTimestamp(),
                  updatedAt: fb.serverTimestamp(),
                }),
                fb.update(profile, { name: current.name, lastActiveAt: fb.serverTimestamp() }),
              ]);
            })
            .then(() => {
              if (disposed) return;
              connected = true;
              onStatus("online");
            })
            .catch(fail);
        },
        fail,
      );

      heartbeat = setInterval(() => {
        if (!connected) return;
        fb.update(presenceNode, { lastSeen: fb.serverTimestamp() }).catch(fail);
      }, HEARTBEAT_INTERVAL_MS);
    })
    .catch(fail);

  const push = (next: Fields) => {
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(next) as (keyof Fields)[]) {
      if (next[key] !== current[key]) changes[key] = next[key];
    }
    current = next;
    // While offline the full record is rewritten on reconnect anyway.
    if (!connected || !node || !client || Object.keys(changes).length === 0) return;
    const fb = client.dbSdk;
    fb.update(node, {
      ...changes,
      lastSeen: fb.serverTimestamp(),
      updatedAt: fb.serverTimestamp(),
    }).catch(fail);
    if ("name" in changes && userRef) {
      fb.update(userRef, { name: next.name, lastActiveAt: fb.serverTimestamp() }).catch(fail);
    }
  };

  return {
    setActivity(activity) {
      push({ ...current, ...activityFields(activity) });
    },
    setName(name) {
      push({ ...current, name });
    },
    stop() {
      disposed = true;
      unsubscribeConnected?.();
      if (heartbeat) clearInterval(heartbeat);
      if (node && client) {
        const fb = client.dbSdk;
        fb.onDisconnect(node).cancel().catch(() => undefined);
        fb.remove(node).catch(() => undefined);
      }
    },
  };
}

/**
 * Subscribes to a database path with the given client kind and also reports
 * the client/server clock offset. Returns an unsubscribe function.
 */
export function subscribeRealtime(
  kind: FirebaseKind,
  path: string,
  onData: (value: unknown) => void,
  onStatus: (status: ConnectionStatus) => void,
  onOffset?: (offsetMs: number) => void,
): () => void {
  let disposed = false;
  const unsubscribers: Unsubscribe[] = [];

  const ready = kind === "student"
    ? getStudentSession().then((s) => s?.client ?? null)
    : getFirebase("admin");

  void ready
    .then((client) => {
      if (disposed) return;
      if (!client) {
        onStatus("disabled");
        return;
      }
      const { db, dbSdk: fb } = client;
      if (onOffset) {
        unsubscribers.push(
          fb.onValue(fb.ref(db, ".info/serverTimeOffset"), (snapshot) => {
            const offset = snapshot.val();
            onOffset(typeof offset === "number" ? offset : 0);
          }),
        );
      }
      unsubscribers.push(
        fb.onValue(
          fb.ref(db, path),
          (snapshot) => {
            onStatus("online");
            onData(snapshot.val());
          },
          (error) => {
            console.warn(`[realtime] ${path}`, error);
            onStatus("error");
          },
        ),
      );
    })
    .catch((error: unknown) => {
      if (disposed) return;
      console.warn(`[realtime] ${path}`, error);
      onStatus("error");
    });

  return () => {
    disposed = true;
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
