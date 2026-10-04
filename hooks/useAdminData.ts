"use client";

import { useMemo } from "react";
import { parseStatsTree, type StatsTree } from "../lib/attempt-model";
import { STATS_PATH } from "../lib/attempts";
import { LESSONS_PATH, parseLessonsSnapshot, validLessons } from "../lib/lessons";
import { USERS_PATH } from "../lib/presence";
import { useRealtimeValue } from "./useRealtimeValue";

export type UserProfile = { name: string; lastActiveAt: number | null };

export function parseUsers(raw: unknown): Record<string, UserProfile> {
  const result: Record<string, UserProfile> = {};
  if (typeof raw !== "object" || raw === null) return result;
  for (const [uid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const v = value as Record<string, unknown>;
    result[uid] = {
      name: typeof v.name === "string" ? v.name : "?",
      lastActiveAt: typeof v.lastActiveAt === "number" ? v.lastActiveAt : null,
    };
  }
  return result;
}

/** All lessons (published or not) — admin only. */
export function useAdminLessons() {
  const { value, status } = useRealtimeValue("admin", LESSONS_PATH);
  return useMemo(() => {
    const stored = parseLessonsSnapshot(value);
    return { stored, lessons: validLessons(stored), status };
  }, [value, status]);
}

export function useAdminUsers() {
  const { value, status } = useRealtimeValue("admin", USERS_PATH);
  return { users: useMemo(() => parseUsers(value), [value]), status };
}

export function useAdminStats(userId?: string) {
  const path = userId ? `${STATS_PATH}/${userId}` : STATS_PATH;
  const { value, status } = useRealtimeValue("admin", path);
  const stats = useMemo<StatsTree>(
    () => (userId ? parseStatsTree(value === null ? {} : { [userId]: value }) : parseStatsTree(value)),
    [value, userId],
  );
  return { stats, status };
}
