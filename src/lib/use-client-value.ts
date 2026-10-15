"use client";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Reads a browser-only value without a hydration mismatch (server renders `serverValue`). */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
