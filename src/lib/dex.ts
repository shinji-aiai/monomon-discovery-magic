import { createPersistentStore } from "./store";
import type { Monomon } from "./monomon";

/** 図鑑（発見したモノモン一覧）。新しい順に並びます。 */
export const dexStore = createPersistentStore<Monomon[]>("monomon.dex.v1", []);

export function useDex() {
  return dexStore.useValue();
}

export function addToDex(monomon: Monomon) {
  dexStore.set((prev) => {
    if (prev.some((m) => m.id === monomon.id)) return prev;
    return [monomon, ...prev];
  });
}

export function removeFromDex(id: string) {
  dexStore.set((prev) => prev.filter((m) => m.id !== id));
}

export function toggleFavorite(id: string) {
  dexStore.set((prev) =>
    prev.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m)),
  );
}

export function clearDex() {
  dexStore.set([]);
}

export function getMonomon(id: string): Monomon | undefined {
  return dexStore.get().find((m) => m.id === id);
}

/** 今日（端末ローカル）見つけた数 */
export function countToday(dex: Monomon[]): number {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();
  return dex.filter((m) => {
    const t = new Date(m.discoveredAt);
    return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d;
  }).length;
}
