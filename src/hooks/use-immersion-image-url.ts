// Phase 1E — Shared IndexedDB → Object URL hook.
// Reads the stored immersion image Blob through the existing immersion-image-store,
// materializes a single Object URL per immersionImageId, and shares it across all
// consumers via a small ref-counted, Strict-Mode-safe module cache.
//
// Rules:
// - Never expose Blob bytes or base64.
// - Never persist the Object URL (no localStorage, no Monomon field).
// - Never mutate the Dex link when retrieval fails.
// - Retrieval failure returns { url: null, loading: false, available: false }.
import { useEffect, useState } from "react";
import { getImmersionImage } from "@/lib/immersion-image-store";

interface CacheEntry {
  refCount: number;
  url: string | null;
  loading: Promise<string | null> | null;
  /** Pending revoke timer, cancelled on re-acquire. */
  revokeTimer: ReturnType<typeof setTimeout> | null;
  /** Generation token used to invalidate late loads / revokes. */
  epoch: number;
}

const cache = new Map<string, CacheEntry>();

function acquire(id: string): CacheEntry {
  let entry = cache.get(id);
  if (!entry) {
    entry = { refCount: 0, url: null, loading: null, revokeTimer: null, epoch: 0 };
    cache.set(id, entry);
  }
  entry.refCount += 1;
  // Cancel any pending revoke — a new consumer wants the URL.
  if (entry.revokeTimer) {
    clearTimeout(entry.revokeTimer);
    entry.revokeTimer = null;
  }
  return entry;
}

function release(id: string) {
  const entry = cache.get(id);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;
  // Strict-Mode-safe: defer the destructive revoke to the next tick so an
  // immediately-following re-mount can cancel it.
  const epochAtSchedule = entry.epoch;
  entry.revokeTimer = setTimeout(() => {
    const current = cache.get(id);
    if (!current) return;
    if (current.refCount > 0) return;
    if (current.epoch !== epochAtSchedule) return;
    if (current.url) URL.revokeObjectURL(current.url);
    cache.delete(id);
  }, 0);
}

async function loadInto(id: string, entry: CacheEntry): Promise<string | null> {
  if (entry.url) return entry.url;
  if (entry.loading) return entry.loading;
  entry.epoch += 1;
  const epochAtLoad = entry.epoch;
  const p = (async () => {
    try {
      const rec = await getImmersionImage(id);
      if (!rec) return null;
      if (!(rec.blob instanceof Blob)) return null;
      if (rec.blob.size <= 0) return null;
      const mime = rec.mimeType || rec.blob.type || "";
      if (!mime.startsWith("image/")) return null;
      // If entry was released & re-created (different epoch), drop.
      const current = cache.get(id);
      if (!current || current.epoch !== epochAtLoad) return null;
      const url = URL.createObjectURL(rec.blob);
      current.url = url;
      return url;
    } catch {
      return null;
    } finally {
      const current = cache.get(id);
      if (current) current.loading = null;
    }
  })();
  entry.loading = p;
  return p;
}

export interface UseImmersionImageUrlResult {
  url: string | null;
  loading: boolean;
  available: boolean;
}

export function useImmersionImageUrl(
  immersionImageId?: string,
  options?: { enabled?: boolean },
): UseImmersionImageUrlResult {
  const enabled = options?.enabled !== false;
  const [url, setUrl] = useState<string | null>(() => {
    if (!immersionImageId) return null;
    return cache.get(immersionImageId)?.url ?? null;
  });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!immersionImageId || !enabled) {
      setUrl(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    const entry = acquire(immersionImageId);
    if (entry.url) {
      setUrl(entry.url);
      setLoading(false);
    } else {
      setLoading(true);
      loadInto(immersionImageId, entry).then((resolved) => {
        if (!mounted) return;
        setUrl(resolved);
        setLoading(false);
      });
    }
    return () => {
      mounted = false;
      release(immersionImageId);
    };
  }, [immersionImageId, enabled]);

  return {
    url,
    loading,
    available: !!url,
  };
}
