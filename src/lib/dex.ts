import { createPersistentStore } from "./store";
import type { Monomon } from "./monomon";
import { withFriendshipGain, reunion, type ReunionResult } from "./friendship";

/**
 * 図鑑（発見したモノモン一覧）。新しい順に並びます。
 *
 * v1.0 と同じ「単純な localStorage 永続化」に戻したストアです。
 * 合成写真（`composedPhoto`）は Monomon オブジェクトに data URL のまま
 * 載せて一緒に保存します。IndexedDB を経由しないので、ナビゲーション・
 * リロード・アプリ再起動を跨いで Memories で確実に表示できます。
 */
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

/**
 * 出会えたモノモンを図鑑に登録します。
 * 同じ ID／同じ元写真から生まれた子はうっかり重複として既存を使い回します。
 * 同じ種族の先住モノモンがいれば「また会えた」と喜びます（friendship +rediscover）。
 */
export async function addToDex(
  monomon: Monomon,
): Promise<{ added: boolean; monomon: Monomon }> {
  const duplicate = dexStore.get().find(
    (m) => m.id === monomon.id || (!!m.photo && m.photo === monomon.photo),
  );
  if (duplicate) return { added: false, monomon: duplicate };

  dexStore.set((prev) => {
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
  newDexStore.set((prev) =>
    prev.includes(monomon.id) ? prev : [monomon.id, ...prev],
  );
  return { added: true, monomon };
}

/** モノモンをタップ（なでる）→ なかよし度 +1 */
export function petMonomon(id: string) {
  dexStore.set((prev) =>
    prev.map((m) => (m.id === id ? withFriendshipGain(m, "pet") : m)),
  );
}

/**
 * 会いに来た（詳細を開いた／発見した）ときに呼びます。
 * 今日はじめての来訪なら再会が成立し、なかよし度 +5・再会回数 +1 を記録します。
 */
export function meetMonomon(id: string): ReunionResult | null {
  let result: ReunionResult | null = null;
  dexStore.set((prev) =>
    prev.map((m) => {
      if (m.id !== id) return m;
      const r = reunion(m);
      if (r.isReunion) result = r;
      return r.monomon;
    }),
  );
  return result;
}

/** 指定した子の NEW! 表示を消します。 */
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
