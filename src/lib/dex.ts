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

export function clearDex() {
  dexStore.set([]);
}

export function getMonomon(id: string): Monomon | undefined {
  return dexStore.get().find((m) => m.id === id);
}
