"use client";

import { useMemo } from "react";
import type { FirebaseKind } from "../lib/firebase";
import { PRESENCE_PATH } from "../lib/presence";
import { buildOnlineUsers, summarizeUsers } from "../lib/presence-model";
import { useNow } from "./useNow";
import { useRealtimeValue } from "./useRealtimeValue";

/** Online people aggregated per user (several tabs = one person). */
export function useOnlineUsers(kind: FirebaseKind, selfUserId: string | null, enabled = true) {
  const { value, status, serverOffset } = useRealtimeValue(kind, enabled ? PRESENCE_PATH : null);
  // Re-evaluate stale sessions periodically even when nothing is written.
  const now = useNow(30_000);
  const users = useMemo(
    () => (now === 0 ? [] : buildOnlineUsers(value, now + serverOffset, selfUserId)),
    [value, now, serverOffset, selfUserId],
  );
  const summary = useMemo(() => summarizeUsers(users), [users]);
  return { users, summary, status };
}
