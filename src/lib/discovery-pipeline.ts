// Phase 1D — Production Discovery Pipeline Integration.
// Coordinates the verified Phase 0/1A/1B/1C components without changing their
// contracts. Recognition happens first; the immersion image generation, on-
// device compression and IndexedDB persistence are strictly non-blocking and
// safely fall back to the existing procedural SVG on any failure.
//
// No retries. No second model call. Exactly one recognition + at most one
// image-generation request per genuinely new photograph.

import { generateMonomon, type Monomon } from "./monomon";
import { generateImmersionImage } from "./monomon-image.functions";
import {
  base64ToBlob,
  compressImmersionImage,
  isImmersionStorageSupported,
  saveImmersionImage,
  type CompressedImmersionImage,
} from "./immersion-image-store";
import { findMonomonByPhoto } from "./dex";

export type PreparedImmersionFailureReason =
  | "unsupported"
  | "generation_failed"
  | "invalid_payload"
  | "compression_failed";

export type PreparedImmersionResult =
  | { ok: true; compressed: CompressedImmersionImage }
  | { ok: false; reason: PreparedImmersionFailureReason };

export interface DiscoverySession {
  monomon: Monomon;
  reusedExisting: boolean;
  immersionTask: Promise<PreparedImmersionResult> | null;
}

async function prepareImmersionImage(
  photo: string,
): Promise<PreparedImmersionResult> {
  if (!isImmersionStorageSupported()) {
    return { ok: false, reason: "unsupported" };
  }
  let result: Awaited<ReturnType<typeof generateImmersionImage>>;
  try {
    result = await generateImmersionImage({ data: { photo } });
  } catch {
    return { ok: false, reason: "generation_failed" };
  }
  if (!result.ok) {
    return { ok: false, reason: "generation_failed" };
  }
  const base64 = result.base64;
  const mime = result.detectedMime;
  if (!base64 || base64.length === 0 || !mime || !mime.startsWith("image/")) {
    return { ok: false, reason: "invalid_payload" };
  }
  let blob: Blob;
  try {
    blob = base64ToBlob(base64, mime);
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
  if (!blob || blob.size === 0) {
    return { ok: false, reason: "invalid_payload" };
  }
  let compressed: CompressedImmersionImage;
  try {
    compressed = await compressImmersionImage(blob);
  } catch {
    return { ok: false, reason: "compression_failed" };
  }
  if (!compressed || !compressed.blob || compressed.blob.size === 0) {
    return { ok: false, reason: "compression_failed" };
  }
  return { ok: true, compressed };
}

/**
 * Coordinates one full discovery for a resized photograph.
 *
 * 1. If an existing Dex record shares the exact same `photo`, reuse it and
 *    perform zero AI calls.
 * 2. Otherwise call `generateMonomon(photo)` first. Recognition rejects (poor
 *    photo, low confidence, network, etc.) propagate unchanged.
 * 3. Only after recognition succeeds, kick off one immersion-image task in
 *    the background. Do NOT await it here.
 */
export async function beginDiscovery(
  photo: string,
): Promise<DiscoverySession> {
  const existing = findMonomonByPhoto(photo);
  if (existing) {
    return { monomon: existing, reusedExisting: true, immersionTask: null };
  }
  const monomon = await generateMonomon(photo);
  const immersionTask = prepareImmersionImage(photo);
  return { monomon, reusedExisting: false, immersionTask };
}

/**
 * Persist a compressed immersion image to IndexedDB under the Monomon ID.
 * Returns the stored ID only after the transaction completes.
 */
export async function persistPreparedImmersion(
  monomonId: string,
  prepared: CompressedImmersionImage,
): Promise<string> {
  await saveImmersionImage({
    id: monomonId,
    blob: prepared.blob,
    mimeType: prepared.mimeType,
    width: prepared.width,
    height: prepared.height,
    sizeBytes: prepared.sizeBytes,
    createdAt: new Date().toISOString(),
  });
  return monomonId;
}
