"use client";

import { useSyncExternalStore } from "react";
import { getPath, subscribePath } from "../lib/router";

export function usePath(serverPath: string): string {
  return useSyncExternalStore(subscribePath, getPath, () => serverPath);
}
