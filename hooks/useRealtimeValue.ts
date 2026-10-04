"use client";

import { useEffect, useState } from "react";
import type { FirebaseKind } from "../lib/firebase";
import { subscribeRealtime, type ConnectionStatus } from "../lib/presence";

/**
 * Live value of one database path. Pass `path = null` to skip subscribing.
 * Each caller subscribes only to the path it needs (no whole-database reads).
 */
export function useRealtimeValue(kind: FirebaseKind, path: string | null) {
  const [state, setState] = useState<{ path: string | null; value: unknown; status: ConnectionStatus }>({
    path: null,
    value: null,
    status: "connecting",
  });
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!path) return;
    return subscribeRealtime(
      kind,
      path,
      (value) => setState({ path, value, status: "online" }),
      (status) => setState((prev) => ({ path, value: prev.path === path ? prev.value : null, status })),
      setOffset,
    );
  }, [kind, path]);

  const current = state.path === path;
  return {
    value: current ? state.value : null,
    status: current ? state.status : ("connecting" as ConnectionStatus),
    serverOffset: offset,
  };
}
