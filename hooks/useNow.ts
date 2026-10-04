"use client";

import { useEffect, useState } from "react";

/** Current time, refreshed every `intervalMs` (0 during server render). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
