import { createPersistentStore } from "./store";
import type { Monomon } from "./monomon";
import { withFriendshipGain, reunion, type ReunionResult } from "./friendship";

/** 図鑑（発見したモノモン一覧）。新しい順に並びます。 */
export const dexStore = createPersistentStore<Monomon[]>("monomon.dex.v1", []);

/** まだ図鑑で「見た」ことのない（新しく登録された）モノモンのID一覧。 */
export const newDexStore = createPersistentStore<string[]>(
  "monomon.dex.new.v1",
  [],
);

export function useDex() {
  return dexStore.useValue();
}

/** 新着（NEW!）のIDリストを購読します。 */
export function useNewDex() {
  return newDexStore.useValue();
}

export function addToDex(monomon: Monomon) {
  dexStore.set((prev) => {
    if (prev.some((m) => m.id === monomon.id)) return prev;
    // 同じ種族の先住モノモンがいれば「また会えた」と喜ぶ（なかよし度 +rediscover）
    const rediscovered = prev.some((m) => m.speciesId === monomon.speciesId);
    const next = rediscovered
      ? prev.map((m) =>
          m.speciesId === monomon.speciesId
            ? withFriendshipGain(m, "rediscover")
            : m,
        )
      : prev;
    return [{ ...monomon, friendship: monomon.friendship ?? 0 }, ...next];
  });
  // 新しく登録された子は「NEW!」として印を付ける（図鑑で見たら消える）
  newDexStore.set((prev) =>
    prev.includes(monomon.id) ? prev : [monomon.id, ...prev],
  );
}

/** モノモンをタップ（なでる）→ なかよし度 +1 */
export function petMonomon(id: string) {
  dexStore.set((prev) =>
    prev.map((m) => (m.id === id ? withFriendshipGain(m, "pet") : m)),
  );
}

/**
 * 会いに来た（詳細を開いた／発見した）ときに呼びます。
 * 今日はじめての来訪なら なかよし度 +5。加算できたら true を返します。
 */
export function meetMonomon(id: string): boolean {
  let gained = false;
  dexStore.set((prev) =>
    prev.map((m) => {
      if (m.id !== id) return m;
      const r = withMeet(m);
      gained = r.gained;
      return r.monomon;
    }),
  );
  return gained;
}

/** 指定した子の NEW! 表示を消します（図鑑で見たとき）。 */
export function clearNew(id: string) {
  newDexStore.set((prev) => prev.filter((x) => x !== id));
}

/** すべての NEW! 表示を消します。 */
export function clearAllNew() {
  newDexStore.set([]);
}

export function removeFromDex(id: string) {
  dexStore.set((prev) => prev.filter((m) => m.id !== id));
  clearNew(id);
}

export function toggleFavorite(id: string) {
  dexStore.set((prev) => {
    const target = prev.find((m) => m.id === id);
    const willFavorite = !target?.favorite;
    return prev.map((m) => ({
      ...m,
      favorite: m.id === id ? willFavorite : false,
    }));
  });
}

export function clearDex() {
  dexStore.set([]);
  clearAllNew();
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
