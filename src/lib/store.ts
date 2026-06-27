import { useSyncExternalStore } from "react";

/**
 * 軽量な localStorage バックの状態ストア。
 * SSR でも安全に動作し、タブ間でも同期します。
 */
export interface PersistentStore<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  useValue: () => T;
}

export function createPersistentStore<T>(
  key: string,
  initial: T,
): PersistentStore<T> {
  const listeners = new Set<() => void>();
  let value: T = initial;
  let hydrated = false;

  const read = (): T => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  };

  const ensureHydrated = () => {
    if (!hydrated && typeof window !== "undefined") {
      value = read();
      hydrated = true;
    }
  };

  const get = () => {
    ensureHydrated();
    return value;
  };

  const set: PersistentStore<T>["set"] = (next) => {
    ensureHydrated();
    value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error("ストアの保存に失敗しました", e);
      }
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    ensureHydrated();
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        value = read();
        listeners.forEach((l) => l());
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  };

  const useValue = () =>
    useSyncExternalStore(subscribe, get, () => initial);

  return { get, set, subscribe, useValue };
}
