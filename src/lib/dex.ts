import { createPersistentStore } from "./store";
import type { Monomon } from "./monomon";
import { withFriendshipGain, reunion, type ReunionResult } from "./friendship";
import {
  saveComposedPhoto,
  deleteComposedPhoto,
  clearAllComposedPhotos,
  dataUrlToBlob,
} from "./photo-storage";

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
  let added = true;
  // 合成写真は IndexedDB に分離保管（localStorage を汚さない）
  const composedDataUrl = monomon.composedPhoto;
  // 永続化するオブジェクトからは in-memory の composedPhoto を必ず剥がす
  const { composedPhoto: _drop, ...persistable } = monomon;
  void _drop;

  dexStore.set((prev) => {
    // 同じIDはもちろん、まったく同じ写真から生まれた子は「うっかり重複」とみなす
    // （同じ1枚をつづけて解析／連続タップ）。既存の記録を使い回して重複登録を防ぐ。
    const duplicate = prev.find(
      (m) => m.id === persistable.id || (!!m.photo && m.photo === persistable.photo),
    );
    if (duplicate) {
      added = false;
      return prev;
    }
    // 同じ種族の先住モノモンがいれば「また会えた」と喜ぶ（なかよし度 +rediscover）
    const rediscovered = prev.some((m) => m.speciesId === persistable.speciesId);
    const next = rediscovered
      ? prev.map((m) =>
          m.speciesId === persistable.speciesId
            ? withFriendshipGain(m, "rediscover")
            : m,
        )
      : prev;
    return [{ ...persistable, friendship: persistable.friendship ?? 0 }, ...next];
  });
  // 新しく登録された子だけ「NEW!」の印を付ける（うっかり重複では付けない）
  if (added) {
    newDexStore.set((prev) =>
      prev.includes(monomon.id) ? prev : [monomon.id, ...prev],
    );
    // 合成写真があれば Blob として保存（一度きり・上書きしない）
    if (composedDataUrl) {
      void saveComposedPhoto(monomon.id, dataUrlToBlob(composedDataUrl));
    }
  }
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
 * 再会が成立したときは詳しい結果（セリフやお祝い演出に使う）を返します。
 * 今日すでに会っていれば null を返します。
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
  void deleteComposedPhoto(id);
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
  void clearAllComposedPhotos();
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
