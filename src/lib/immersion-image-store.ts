// Phase 1B — Isolated immersion image storage foundation.
// Native IndexedDB + Canvas compression. No network, no AI, no localStorage.
// Not yet connected to normal Monomon flows.

const DB_NAME = "monomon.immersion.v1";
const DB_VERSION = 1;
const STORE_NAME = "images";

export interface StoredImmersionImage {
  id: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
}

export interface CompressedImmersionImage {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalSizeBytes: number;
  qualityUsed: number;
  formatUsed: "image/webp" | "image/jpeg" | "image/png" | string;
}

const MAX_LONG_SIDE = 1080;
const MIN_LONG_SIDE = 720;
const SOFT_TARGET_BYTES = 450_000;

export function isImmersionStorageSupported(): boolean {
  try {
    return typeof indexedDB !== "undefined" && typeof Blob !== "undefined";
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isImmersionStorageSupported()) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | null> {
  const db = await openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let value: T | null = null;
      let requestErr: unknown = null;
      const req = fn(store);
      if (req) {
        req.onsuccess = () => {
          value = (req.result as T) ?? null;
        };
        req.onerror = () => {
          requestErr = req.error ?? new Error("IndexedDB request failed");
        };
      }
      tx.oncomplete = () => {
        if (requestErr) reject(requestErr);
        else resolve(value);
      };
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
  } finally {
    db.close();
  }
}

export async function saveImmersionImage(record: StoredImmersionImage): Promise<void> {
  await withStore("readwrite", (store) => store.put(record));
}

export async function getImmersionImage(id: string): Promise<StoredImmersionImage | null> {
  // Safari/WKWebView can return an IndexedDB-backed Blob whose underlying
  // storage becomes unreadable ("The object can not be found here.") after
  // the db connection closes. Materialize the bytes into a detached Blob
  // BEFORE the transaction / connection ends.
  const db = await openDb();
  try {
    const raw = await new Promise<StoredImmersionImage | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      let value: StoredImmersionImage | null = null;
      req.onsuccess = () => {
        value = (req.result as StoredImmersionImage) ?? null;
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
    if (!raw) return null;
    if (!(raw.blob instanceof Blob)) {
      throw new Error("stored record is missing a Blob");
    }
    const buf = await raw.blob.arrayBuffer();
    if (!buf || buf.byteLength === 0) {
      throw new Error("stored Blob materialized to zero bytes");
    }
    const mimeType = raw.mimeType || raw.blob.type || "application/octet-stream";
    const detached = new Blob([buf], { type: mimeType });
    return {
      id: raw.id,
      blob: detached,
      mimeType,
      width: raw.width,
      height: raw.height,
      sizeBytes: detached.size,
      createdAt: raw.createdAt,
    };
  } finally {
    db.close();
  }
}

export async function deleteImmersionImage(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function clearImmersionImages(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}

export async function countImmersionImages(): Promise<number> {
  const value = await withStore<number>("readonly", (store) => store.count());
  return value ?? 0;
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const bin = atob(clean);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decodeBlob(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          if (typeof (bitmap as ImageBitmap).close === "function") {
            (bitmap as ImageBitmap).close();
          }
        },
      };
    } catch {
      // fall through
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode image"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

async function encodeAtSize(
  src: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  type: "image/webp" | "image/jpeg",
  quality: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, targetWidth, targetHeight);
  const blob = await canvasToBlob(canvas, type, quality);
  if (!blob || blob.size === 0 || !blob.type.startsWith("image/")) return null;
  // If the browser silently swapped format (e.g. WebP unsupported → PNG),
  // reject so caller can fall back.
  if (type === "image/webp" && !blob.type.includes("webp")) return null;
  if (type === "image/jpeg" && !blob.type.includes("jpeg") && !blob.type.includes("jpg")) return null;
  return { blob, width: targetWidth, height: targetHeight };
}

export async function compressImmersionImage(input: Blob): Promise<CompressedImmersionImage> {
  const originalSizeBytes = input.size;
  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeBlob(input);
    const srcW = decoded.width;
    const srcH = decoded.height;
    const longSide = Math.max(srcW, srcH);
    // Never upscale.
    const initialLong = Math.min(longSide, MAX_LONG_SIDE);

    const dims = (long: number) => {
      const scale = long / longSide;
      return {
        w: Math.max(1, Math.round(srcW * scale)),
        h: Math.max(1, Math.round(srcH * scale)),
      };
    };

    const qualitySteps = [0.84, 0.78, 0.72, 0.66, 0.6];
    const longSteps: number[] = [];
    // Progressive downscale steps down to MIN_LONG_SIDE.
    for (let l = initialLong; l >= MIN_LONG_SIDE; l = Math.max(MIN_LONG_SIDE, Math.round(l * 0.85))) {
      longSteps.push(l);
      if (l === MIN_LONG_SIDE) break;
    }
    if (longSteps[longSteps.length - 1] !== MIN_LONG_SIDE && initialLong > MIN_LONG_SIDE) {
      longSteps.push(MIN_LONG_SIDE);
    }

    let best: { blob: Blob; width: number; height: number; type: "image/webp" | "image/jpeg"; quality: number } | null =
      null;

    for (const long of longSteps) {
      const { w, h } = dims(long);
      for (const q of qualitySteps) {
        for (const type of ["image/webp", "image/jpeg"] as const) {
          const out = await encodeAtSize(decoded.source, w, h, type, q);
          if (!out) continue;
          if (!best || out.blob.size < best.blob.size) {
            best = { blob: out.blob, width: out.width, height: out.height, type, quality: q };
          }
          if (out.blob.size <= SOFT_TARGET_BYTES) {
            return {
              blob: out.blob,
              mimeType: type,
              width: out.width,
              height: out.height,
              sizeBytes: out.blob.size,
              originalSizeBytes,
              qualityUsed: q,
              formatUsed: type,
            };
          }
        }
      }
    }

    if (best) {
      return {
        blob: best.blob,
        mimeType: best.type,
        width: best.width,
        height: best.height,
        sizeBytes: best.blob.size,
        originalSizeBytes,
        qualityUsed: best.quality,
        formatUsed: best.type,
      };
    }

    // All encoding attempts failed — return original untouched.
    return {
      blob: input,
      mimeType: input.type || "application/octet-stream",
      width: srcW,
      height: srcH,
      sizeBytes: input.size,
      originalSizeBytes,
      qualityUsed: 1,
      formatUsed: input.type || "application/octet-stream",
    };
  } finally {
    decoded?.cleanup();
  }
}
