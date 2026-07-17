/**
 * 合成写真ストレージ（IndexedDB）。
 *
 * localStorage は 5MB 前後で枯れ、data URL 化した合成PNG（200–500KB）を
 * 個体数ぶん置くとすぐに破綻します。合成PNGだけを IndexedDB に Blob として
 * 分離保管し、Monomon 本体には hasComposed フラグだけを載せることで
 * ストレージ枯渇と localStorage 上限の両方を根本回避します。
 *
 * 設計上の役割：
 *  - 保存：発見の瞬間に生まれた「1枚」を Blob として固定
 *  - 読み出し：URL.createObjectURL で <img src> にそのまま渡せる
 *  - 削除：Monomon 削除時に対応する Blob も消す
 *  - 一貫性：同じ子は常に同じ Blob（AIで再生成しない）
 */

import { createStore, del, get, set, clear } from "idb-keyval";

const store =
  typeof indexedDB !== "undefined"
    ? createStore("monomon.photo", "composed")
    : null;

/** 合成PNGを保存する（既にあれば上書きしない=一貫性を守る）。 */
export async function saveComposedPhoto(
  monomonId: string,
  blob: Blob,
): Promise<void> {
  if (!store) throw new Error("INDEXEDDB_UNAVAILABLE");
  const existing = await get<Blob>(monomonId, store);
  if (existing) return; // 一度生まれた姿は変えない
  await set(monomonId, blob, store);
  const saved = await get<Blob>(monomonId, store);
  if (!saved || saved.size !== blob.size) throw new Error("COMPOSED_IMAGE_SAVE_VERIFICATION_FAILED");
}

/** 合成PNGを取り出す。無ければ null。 */
export async function getComposedPhoto(monomonId: string): Promise<Blob | null> {
  if (!store) return null;
  try {
    const b = await get<Blob>(monomonId, store);
    return b ?? null;
  } catch {
    return null;
  }
}

/** Monomonの削除に合わせて Blob も削除。 */
export async function deleteComposedPhoto(monomonId: string): Promise<void> {
  if (!store) return;
  try {
    await del(monomonId, store);
  } catch (e) {
    console.error("[monomon] 合成写真の削除に失敗", e);
  }
}

/** 図鑑クリア時に全消去。 */
export async function clearAllComposedPhotos(): Promise<void> {
  if (!store) return;
  try {
    await clear(store);
  } catch (e) {
    console.error("[monomon] 合成写真の全消去に失敗", e);
  }
}

/** dataURL(base64) を Blob に変換する（サーバー関数から返る文字列用）。 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const m = /data:([^;]+);base64/.exec(head ?? "");
  const mime = m?.[1] ?? "image/png";
  const bin = atob(b64 ?? "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
