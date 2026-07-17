/**
 * 合成写真ストレージ（IndexedDB を第一 / localStorage をフォールバック）。
 *
 * 目的：
 *   「出会えた1枚」を、ナビゲーション・リロード・ブラウザ再起動を跨いで
 *   必ず表示できる形で保存する。ゆえに blob: URL や component-state で
 *   保持することは絶対にしない。
 *
 * 二層戦略：
 *   1) IndexedDB に Blob を保存（読み出しは URL.createObjectURL で <img> に渡す）
 *   2) 同時に localStorage(`monomon.photo.<id>`) に完全な data:image/…;base64 URL を保存
 *      →  iOS Safari のプライベートモード等で IDB が使えない／読めない場合の保険
 *   3) 読み出し順は IDB → localStorage → null
 *
 * すべての保存パスは「保存直後に読み戻して検証」する。検証に失敗したものは
 * 保存されなかったものとして扱い、上位の呼び出しに例外を伝える。
 */

import { createStore, del, get, set, clear } from "idb-keyval";

const store =
  typeof indexedDB !== "undefined"
    ? createStore("monomon.photo", "composed")
    : null;

const LS_PREFIX = "monomon.photo.";
const DATAURL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export interface ComposedPhotoRef {
  /** <img src> にそのまま渡せるURL（blob: または data:）。 */
  url: string;
  /** 由来。診断ログのために持つ。 */
  source: "idb" | "localStorage";
  /** blob: URL の場合のみセットされる（アンマウント時に revoke するため）。 */
  revoke?: () => void;
}

/**
 * 合成写真を「複数の場所」に耐久保存する。
 * dataUrl を受け取り、Blob に変換して IDB へ、同じ dataUrl を localStorage へ書く。
 * 一度も保存に成功しなかった場合だけ例外を投げる。
 */
export async function saveComposedPhoto(
  monomonId: string,
  dataUrl: string,
): Promise<{ savedTo: Array<"idb" | "localStorage"> }> {
  if (!DATAURL_RE.test(dataUrl)) {
    throw new Error("COMPOSED_IMAGE_INVALID_DATAURL");
  }

  const saved: Array<"idb" | "localStorage"> = [];

  // 1) IndexedDB へ Blob を保存
  if (store) {
    try {
      const blob = dataUrlToBlob(dataUrl);
      await set(monomonId, blob, store);
      const readback = await get<Blob>(monomonId, store);
      if (readback && readback.size === blob.size) {
        saved.push("idb");
      } else {
        console.warn("[monomon-photo]", {
          stage: "IDB_SAVE_VERIFICATION_FAILED",
          monomonId,
          expectedBytes: blob.size,
          readbackBytes: readback?.size ?? null,
        });
      }
    } catch (e) {
      console.warn("[monomon-photo]", {
        stage: "IDB_SAVE_FAILED",
        monomonId,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    console.warn("[monomon-photo]", {
      stage: "IDB_UNAVAILABLE",
      monomonId,
    });
  }

  // 2) localStorage へ dataUrl を保存（IDB が使えない・消えた場合の保険）
  if (typeof window !== "undefined") {
    try {
      // 一度に多く積むと 5MB 上限を超えて全部落ちる。積む前に古いものを間引く。
      trimLocalStorageIfNeeded(dataUrl.length);
      window.localStorage.setItem(LS_PREFIX + monomonId, dataUrl);
      const readback = window.localStorage.getItem(LS_PREFIX + monomonId);
      if (readback && readback.length === dataUrl.length) {
        saved.push("localStorage");
      } else {
        console.warn("[monomon-photo]", {
          stage: "LOCALSTORAGE_SAVE_VERIFICATION_FAILED",
          monomonId,
          expectedLength: dataUrl.length,
          readbackLength: readback?.length ?? null,
        });
      }
    } catch (e) {
      console.warn("[monomon-photo]", {
        stage: "LOCALSTORAGE_SAVE_FAILED",
        monomonId,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (saved.length === 0) {
    throw new Error("COMPOSED_IMAGE_PERSIST_FAILED_ALL_BACKENDS");
  }

  console.info("[monomon-photo]", {
    stage: "COMPOSED_IMAGE_PERSISTED",
    monomonId,
    savedTo: saved,
    urlPrefix: dataUrl.slice(0, 24),
    urlLength: dataUrl.length,
  });

  return { savedTo: saved };
}

/**
 * 描画に使える耐久URLを取り出す。
 * IDB → localStorage の順で探し、見つからなければ null。
 * blob: を返した場合は呼び出し側で revoke() を呼ぶ必要がある。
 */
export async function getComposedPhotoRef(
  monomonId: string,
): Promise<ComposedPhotoRef | null> {
  // 1) IDB
  if (store) {
    try {
      const b = await get<Blob>(monomonId, store);
      if (b && b.size > 0) {
        const url = URL.createObjectURL(b);
        return { url, source: "idb", revoke: () => URL.revokeObjectURL(url) };
      }
    } catch (e) {
      console.warn("[monomon-photo]", {
        stage: "IDB_READ_FAILED",
        monomonId,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }
  // 2) localStorage フォールバック
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + monomonId);
      if (raw && DATAURL_RE.test(raw)) {
        return { url: raw, source: "localStorage" };
      }
    } catch (e) {
      console.warn("[monomon-photo]", {
        stage: "LOCALSTORAGE_READ_FAILED",
        monomonId,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return null;
}

/** Monomonの削除に合わせて Blob も dataUrl も削除。 */
export async function deleteComposedPhoto(monomonId: string): Promise<void> {
  if (store) {
    try {
      await del(monomonId, store);
    } catch (e) {
      console.error("[monomon-photo] IDB delete failed", e);
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LS_PREFIX + monomonId);
    } catch {
      /* ignore */
    }
  }
}

/** 図鑑クリア時に全消去。 */
export async function clearAllComposedPhotos(): Promise<void> {
  if (store) {
    try {
      await clear(store);
    } catch (e) {
      console.error("[monomon-photo] IDB clear failed", e);
    }
  }
  if (typeof window !== "undefined") {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

/** dataURL(base64) を Blob に変換する。 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const m = /data:([^;]+);base64/.exec(head ?? "");
  const mime = m?.[1] ?? "image/png";
  const bin = atob(b64 ?? "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * localStorage が満杯にならないよう、必要なぶんだけ古い写真エントリを削る。
 * localStorage は 5MB 前後で頭打ち。新しく積む写真の分の余裕を粗く見積もる。
 */
function trimLocalStorageIfNeeded(incomingBytes: number): void {
  if (typeof window === "undefined") return;
  const BUDGET = 3_500_000; // 安全マージン込みで 3.5MB を目安
  try {
    const photoKeys: string[] = [];
    let currentBytes = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX)) continue;
      photoKeys.push(k);
      currentBytes += (window.localStorage.getItem(k) ?? "").length;
    }
    if (currentBytes + incomingBytes <= BUDGET) return;
    // 単純に古い順（挿入順）に削る。key に時刻情報を持たないため、
    // 先頭から必要ぶんだけ落とす。写真は思い出だが、localStorage はあくまで
    // IDB の保険であり、IDB 側には残る前提。
    for (const k of photoKeys) {
      if (currentBytes + incomingBytes <= BUDGET) break;
      const size = (window.localStorage.getItem(k) ?? "").length;
      window.localStorage.removeItem(k);
      currentBytes -= size;
    }
  } catch {
    /* localStorage 自体が使えない状況では何もしない */
  }
}
