// Phase 1B — Isolated storage test route.
// Temporary, unlisted, no navigation link, no production or AI imports.
// Uses only native browser APIs + local immersion-image-store module.

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  compressImmersionImage,
  countImmersionImages,
  deleteImmersionImage,
  getImmersionImage,
  isImmersionStorageSupported,
  saveImmersionImage,
  sha256Blob,
  type CompressedImmersionImage,
  type StoredImmersionImage,
} from "@/lib/immersion-image-store";

export const Route = createFileRoute("/phase1b-storage-test")({
  component: Phase1BStorageTest,
});

const TEST_ID = "phase1b-storage-test";

interface OriginalInfo {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

interface RunReport {
  originalHash?: string;
  compressed?: CompressedImmersionImage;
  savedHash?: string;
  retrievedHash?: string;
  hashesMatch?: boolean;
  saveMs?: number;
  loadMs?: number;
  error?: string;
}

async function getDims(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bm = await createImageBitmap(blob);
      const d = { width: bm.width, height: bm.height };
      if (typeof bm.close === "function") bm.close();
      return d;
    } catch {
      // fall through
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function safeErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return "unknown error";
  }
}

function Phase1BStorageTest() {
  const supported = typeof window !== "undefined" ? isImmersionStorageSupported() : false;
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalInfo, setOriginalInfo] = useState<OriginalInfo | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [retrievedUrl, setRetrievedUrl] = useState<string | null>(null);
  const [recordExists, setRecordExists] = useState<boolean>(false);
  const [count, setCount] = useState<number>(0);
  const [report, setReport] = useState<RunReport>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("idle");

  const originalUrlRef = useRef<string | null>(null);
  const retrievedUrlRef = useRef<string | null>(null);

  const setOriginalPreview = useCallback((blob: Blob | null) => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (blob) {
      const u = URL.createObjectURL(blob);
      originalUrlRef.current = u;
      setOriginalUrl(u);
    } else {
      originalUrlRef.current = null;
      setOriginalUrl(null);
    }
  }, []);

  const setRetrievedPreview = useCallback((blob: Blob | null) => {
    if (retrievedUrlRef.current) URL.revokeObjectURL(retrievedUrlRef.current);
    if (blob) {
      const u = URL.createObjectURL(blob);
      retrievedUrlRef.current = u;
      setRetrievedUrl(u);
    } else {
      retrievedUrlRef.current = null;
      setRetrievedUrl(null);
    }
  }, []);

  const refreshMeta = useCallback(async () => {
    if (!supported) return;
    try {
      const existing = await getImmersionImage(TEST_ID);
      setRecordExists(!!existing);
      setCount(await countImmersionImages());
    } catch (e) {
      setStatus(`meta error: ${safeErr(e)}`);
    }
  }, [supported]);

  useEffect(() => {
    void refreshMeta();
    return () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
      if (retrievedUrlRef.current) URL.revokeObjectURL(retrievedUrlRef.current);
    };
  }, [refreshMeta]);

  const onPick = useCallback(
    async (file: File) => {
      setReport({});
      setStatus("picked");
      setOriginalFile(file);
      setOriginalPreview(file);
      try {
        const dims = await getDims(file);
        setOriginalInfo({ mimeType: file.type || "application/octet-stream", sizeBytes: file.size, ...dims });
      } catch (e) {
        setOriginalInfo({ mimeType: file.type || "application/octet-stream", sizeBytes: file.size, width: 0, height: 0 });
        setStatus(`decode warning: ${safeErr(e)}`);
      }
    },
    [setOriginalPreview],
  );

  const onCompressAndSave = useCallback(async () => {
    if (!originalFile || !supported) return;
    setBusy(true);
    setStatus("compressing");
    const r: RunReport = {};
    try {
      const compressed = await compressImmersionImage(originalFile);
      r.compressed = compressed;
      const savedHash = await sha256Blob(compressed.blob);
      r.savedHash = savedHash;
      const record: StoredImmersionImage = {
        id: TEST_ID,
        blob: compressed.blob,
        mimeType: compressed.mimeType,
        width: compressed.width,
        height: compressed.height,
        sizeBytes: compressed.sizeBytes,
        createdAt: new Date().toISOString(),
      };
      const t0 = performance.now();
      await saveImmersionImage(record);
      const t1 = performance.now();
      r.saveMs = Math.round(t1 - t0);

      setStatus("retrieving");
      const t2 = performance.now();
      const back = await getImmersionImage(TEST_ID);
      const t3 = performance.now();
      r.loadMs = Math.round(t3 - t2);
      if (!back) throw new Error("record not found after save");
      const retrievedHash = await sha256Blob(back.blob);
      r.retrievedHash = retrievedHash;
      r.hashesMatch = retrievedHash === savedHash;
      setRetrievedPreview(back.blob);
      setStatus("done");
    } catch (e) {
      r.error = safeErr(e);
      setStatus(`error: ${r.error}`);
    } finally {
      setReport(r);
      await refreshMeta();
      setBusy(false);
    }
  }, [originalFile, supported, setRetrievedPreview, refreshMeta]);

  const onReload = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setStatus("reloading");
    try {
      const t0 = performance.now();
      const back = await getImmersionImage(TEST_ID);
      const t1 = performance.now();
      if (!back) {
        setStatus("no stored record");
        setRetrievedPreview(null);
      } else {
        const h = await sha256Blob(back.blob);
        setRetrievedPreview(back.blob);
        setReport((prev) => ({
          ...prev,
          retrievedHash: h,
          loadMs: Math.round(t1 - t0),
          hashesMatch: prev.savedHash ? prev.savedHash === h : undefined,
        }));
        setStatus("reloaded");
      }
    } catch (e) {
      setStatus(`error: ${safeErr(e)}`);
    } finally {
      await refreshMeta();
      setBusy(false);
    }
  }, [supported, setRetrievedPreview, refreshMeta]);

  const onDelete = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setStatus("deleting");
    try {
      await deleteImmersionImage(TEST_ID);
      const back = await getImmersionImage(TEST_ID);
      if (back) throw new Error("record still present after delete");
      setRetrievedPreview(null);
      setReport({});
      setStatus("deleted");
    } catch (e) {
      setStatus(`error: ${safeErr(e)}`);
    } finally {
      await refreshMeta();
      setBusy(false);
    }
  }, [supported, setRetrievedPreview, refreshMeta]);

  const c = report.compressed;
  const pct =
    c && originalInfo && originalInfo.sizeBytes > 0
      ? Math.round((c.sizeBytes / originalInfo.sizeBytes) * 100)
      : null;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Phase 1B — Storage Test</h1>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Isolated. No AI, no network, no localStorage. IndexedDB only. Fixed id: <code>{TEST_ID}</code>
      </p>

      <div style={{ display: "grid", gap: 4, fontSize: 13, marginTop: 12 }}>
        <div>IndexedDB supported: <b>{supported ? "yes" : "no"}</b></div>
        <div>Record exists: <b>{recordExists ? "yes" : "no"}</b></div>
        <div>Record count: <b>{count}</b></div>
        <div>Status: <b>{status}</b></div>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={onCompressAndSave} disabled={!originalFile || !supported || busy}>
          Compress and save
        </button>
        <button onClick={onReload} disabled={!supported || busy}>
          Reload stored image
        </button>
        <button onClick={onDelete} disabled={!supported || busy}>
          Delete test image
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Original</div>
          {originalUrl ? (
            <img src={originalUrl} alt="original" style={{ width: "100%", height: "auto", borderRadius: 6 }} />
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6 }}>(none)</div>
          )}
          {originalInfo && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <div>MIME: {originalInfo.mimeType}</div>
              <div>Size: {originalInfo.sizeBytes.toLocaleString()} bytes</div>
              <div>Dim: {originalInfo.width}×{originalInfo.height}</div>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Retrieved from IndexedDB</div>
          {retrievedUrl ? (
            <img src={retrievedUrl} alt="retrieved" style={{ width: "100%", height: "auto", borderRadius: 6 }} />
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6 }}>(none)</div>
          )}
          {c && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <div>MIME: {c.mimeType}</div>
              <div>Size: {c.sizeBytes.toLocaleString()} bytes</div>
              <div>Dim: {c.width}×{c.height}</div>
              <div>Quality: {c.qualityUsed}</div>
              <div>Format: {c.formatUsed}</div>
              {pct !== null && <div>Compression: {pct}% of original</div>}
            </div>
          )}
        </div>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ fontSize: 12, display: "grid", gap: 2 }}>
        <div>SHA-256 (saved): <code style={{ wordBreak: "break-all" }}>{report.savedHash ?? "—"}</code></div>
        <div>SHA-256 (retrieved): <code style={{ wordBreak: "break-all" }}>{report.retrievedHash ?? "—"}</code></div>
        <div>Hashes match: <b>{report.hashesMatch === undefined ? "—" : report.hashesMatch ? "yes" : "no"}</b></div>
        <div>Save duration: {report.saveMs ?? "—"} ms</div>
        <div>Load duration: {report.loadMs ?? "—"} ms</div>
        {report.error && <div style={{ color: "crimson" }}>Error: {report.error}</div>}
      </div>
    </div>
  );
}
