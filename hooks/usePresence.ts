"use client";

import { useEffect, useRef, useState } from "react";
import { setUserId } from "../lib/identity";
import { startPresence, type ConnectionStatus, type PresenceHandle } from "../lib/presence";
import type { Activity } from "../lib/presence-model";

/**
 * Keeps this tab's presence session in sync with what the student is doing.
 * `activity` should be memoised by the caller; only changed fields are sent.
 * Pass `name = null` (no name yet, or on admin pages) to publish nothing.
 */
export function usePresence(sessionId: string, name: string | null, activity: Activity) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const handleRef = useRef<PresenceHandle | null>(null);
  const activityRef = useRef(activity);
  const nameRef = useRef(name);
  const active = Boolean(name && sessionId);

  useEffect(() => {
    if (!active || !nameRef.current) return;
    const handle = startPresence(sessionId, nameRef.current, activityRef.current, setStatus, setUserId);
    handleRef.current = handle;
    return () => {
      handle.stop();
      handleRef.current = null;
    };
  }, [active, sessionId]);

  useEffect(() => {
    activityRef.current = activity;
    handleRef.current?.setActivity(activity);
  }, [activity]);

  useEffect(() => {
    nameRef.current = name;
    if (name) handleRef.current?.setName(name);
  }, [name]);

  return status;
}
