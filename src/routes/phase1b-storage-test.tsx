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

type Stage =
  | "idle"
  | "open-database"
  | "read-record"
  | "transaction-complete"
  | "detach-blob"
  | "calculate-hash"
  | "create-object-url"
  | "render-image"
  | "done";

interface OriginalInfo {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

interface StoredMeta {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
}

interface RetrievedInfo {
  mimeType: string;
  sizeBytes: number;
}

interface RunReport {
  compressed?: CompressedImmersionImage;
  savedHash?: string;
  retrievedHash?: string;
  hashesMatch?: boolean;
  saveMs?: number;
  loadMs?: number;
  storedMeta?: StoredMeta;
  retrieved?: RetrievedInfo;
  errorStage?: Stage;
  errorName?: string;
  errorMessage?: string;
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

function safeErr(e: unknown): { name: string; message: string } {
  if (e instanceof DOMException) return { name: e.name, message: e.message };
  if (e instanceof Error) return { name: e.name || "Error", message: e.message };
  try {
    return { name: "Unknown", message: String(e) };
  } catch {
    return { name: "Unknown", message: "unknown error" };
  }
}

const btnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  border: "1px solid #333",
  borderRadius: 8,
  background: "#f5f5f5",
  color: "#111",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  minWidth: 160,
};

const btnDisabledStyle: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.5,
  cursor: "not-allowed",
};

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
  const [stage, setStage] = useState<Stage>("idle");
  const [renderError, setRenderError] = useState<string | null>(null);

  // Hold current object URLs in refs so we only revoke on replacement/unmount.
  const originalUrlRef = useRef<string | null>(null);
  const retrievedUrlRef = useRef<string | null>(null);
  const autoLoadedRef = useRef(false);

  const swapOriginalUrl = useCallback((blob: Blob | null) => {
    const prev = originalUrlRef.current;
    if (blob) {
      const u = URL.createObjectURL(blob);
      originalUrlRef.current = u;
      setOriginalUrl(u);
    } else {
      originalUrlRef.current = null;
      setOriginalUrl(null);
    }
    // Revoke previous only AFTER new one is installed, on a later tick so
    // React Strict Mode's double-invoked effects don't kill a live URL.
    if (prev) {
      setTimeout(() => URL.revokeObjectURL(prev), 0);
    }
  }, []);

  const swapRetrievedUrl = useCallback((blob: Blob | null) => {
    const prev = retrievedUrlRef.current;
    if (blob) {
      const u = URL.createObjectURL(blob);
      retrievedUrlRef.current = u;
      setRetrievedUrl(u);
    } else {
      retrievedUrlRef.current = null;
      setRetrievedUrl(null);
    }
    if (prev) {
      setTimeout(() => URL.revokeObjectURL(prev), 0);
    }
  }, []);

  const refreshMeta = useCallback(async () => {
    if (!supported) return { exists: false };
    try {
      const existing = await getImmersionImage(TEST_ID);
      setRecordExists(!!existing);
      setCount(await countImmersionImages());
      return { exists: !!existing, record: existing };
    } catch (e) {
      const s = safeErr(e);
      setStage("read-record");
      setReport((prev) => ({ ...prev, errorStage: "read-record", errorName: s.name, errorMessage: s.message }));
      return { exists: false };
    }
  }, [supported]);

  const performReload = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setRenderError(null);
    let currentStage: Stage = "open-database";
    setStage(currentStage);
    try {
      const t0 = performance.now();
      currentStage = "read-record";
      setStage(currentStage);
      const back = await getImmersionImage(TEST_ID);
      const t1 = performance.now();
      currentStage = "transaction-complete";
      setStage(currentStage);
      if (!back) {
        setReport((prev) => ({
          ...prev,
          retrieved: undefined,
          loadMs: Math.round(t1 - t0),
        }));
        swapRetrievedUrl(null);
        setStage("idle");
        return;
      }
      currentStage = "detach-blob";
      setStage(currentStage);
      if (!(back.blob instanceof Blob) || back.blob.size === 0) {
        throw new Error(`retrieved blob invalid: type=${back.blob?.type ?? "?"} size=${back.blob?.size ?? 0}`);
      }
      const retrieved: RetrievedInfo = { mimeType: back.blob.type, sizeBytes: back.blob.size };
      const storedMeta: StoredMeta = {
        mimeType: back.mimeType,
        sizeBytes: back.sizeBytes,
        width: back.width,
        height: back.height,
        createdAt: back.createdAt,
      };

      currentStage = "calculate-hash";
      setStage(currentStage);
      const h = await sha256Blob(back.blob);

      currentStage = "create-object-url";
      setStage(currentStage);
      swapRetrievedUrl(back.blob);

      currentStage = "render-image";
      setStage(currentStage);

      setReport((prev) => ({
        ...prev,
        retrievedHash: h,
        loadMs: Math.round(t1 - t0),
        storedMeta,
        retrieved,
        hashesMatch: prev.savedHash ? prev.savedHash === h : undefined,
        errorStage: undefined,
        errorName: undefined,
        errorMessage: undefined,
      }));
      setStage("done");
    } catch (e) {
      const s = safeErr(e);
      setReport((prev) => ({ ...prev, errorStage: currentStage, errorName: s.name, errorMessage: s.message }));
      setStage(currentStage);
    } finally {
      await refreshMeta();
      setBusy(false);
    }
  }, [supported, swapRetrievedUrl, refreshMeta]);

  // On mount: probe support + record existence, and auto-load if a record
  // is already there (so a page refresh alone proves durability).
  useEffect(() => {
    if (!supported) return;
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    (async () => {
      const meta = await refreshMeta();
      if (meta.exists) {
        await performReload();
      }
    })();
  }, [supported, refreshMeta, performReload]);

  // Unmount cleanup only. Do NOT include url state in deps; that would
  // revoke live URLs on every swap.
  useEffect(() => {
    return () => {
      const a = originalUrlRef.current;
      const b = retrievedUrlRef.current;
      originalUrlRef.current = null;
      retrievedUrlRef.current = null;
      if (a) URL.revokeObjectURL(a);
      if (b) URL.revokeObjectURL(b);
    };
  }, []);

  const onPick = useCallback(
    async (file: File) => {
      setReport({});
      setRenderError(null);
      setStage("idle");
      setOriginalFile(file);
      swapOriginalUrl(file);
      try {
        const dims = await getDims(file);
        setOriginalInfo({ mimeType: file.type || "application/octet-stream", sizeBytes: file.size, ...dims });
      } catch (e) {
        setOriginalInfo({
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          width: 0,
          height: 0,
        });
        const s = safeErr(e);
        setReport((prev) => ({ ...prev, errorStage: "render-image", errorName: s.name, errorMessage: s.message }));
      }
    },
    [swapOriginalUrl],
  );

  const onCompressAndSave = useCallback(async () => {
    if (!originalFile || !supported) return;
    setBusy(true);
    setRenderError(null);
    let currentStage: Stage = "detach-blob";
    setStage(currentStage);
    const r: RunReport = {};
    try {
      const compressed = await compressImmersionImage(originalFile);
      r.compressed = compressed;
      currentStage = "calculate-hash";
      setStage(currentStage);
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
      currentStage = "open-database";
      setStage(currentStage);
      const t0 = performance.now();
      await saveImmersionImage(record);
      const t1 = performance.now();
      r.saveMs = Math.round(t1 - t0);
      setReport(r);
      await performReload();
    } catch (e) {
      const s = safeErr(e);
      r.errorStage = currentStage;
      r.errorName = s.name;
      r.errorMessage = s.message;
      setReport(r);
      setStage(currentStage);
    } finally {
      await refreshMeta();
      setBusy(false);
    }
  }, [originalFile, supported, performReload, refreshMeta]);

  const onDelete = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setRenderError(null);
    setStage("open-database");
    try {
      await deleteImmersionImage(TEST_ID);
      const back = await getImmersionImage(TEST_ID);
      if (back) throw new Error("record still present after delete");
      swapRetrievedUrl(null);
      setReport({});
      setStage("idle");
    } catch (e) {
      const s = safeErr(e);
      setReport((prev) => ({ ...prev, errorStage: "read-record", errorName: s.name, errorMessage: s.message }));
    } finally {
      await refreshMeta();
      setBusy(false);
    }
  }, [supported, swapRetrievedUrl, refreshMeta]);

  const c = report.compressed;
  const pct =
    c && originalInfo && originalInfo.sizeBytes > 0
      ? Math.round((c.sizeBytes / originalInfo.sizeBytes) * 100)
      : null;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto", color: "#111" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Phase 1B — Storage Test</h1>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Isolated. No AI, no network, no localStorage. IndexedDB only. Fixed id: <code>{TEST_ID}</code>
      </p>

      <div style={{ display: "grid", gap: 4, fontSize: 13, marginTop: 12 }}>
        <div>IndexedDB supported: <b>{supported ? "yes" : "no"}</b></div>
        <div>Record exists: <b>{recordExists ? "yes" : "no"}</b></div>
        <div>Record count: <b>{count}</b></div>
        <div>Stage: <b>{stage}</b></div>
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

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onCompressAndSave}
          disabled={!originalFile || !supported || busy}
          style={!originalFile || !supported || busy ? btnDisabledStyle : btnStyle}
        >
          Compress and save
        </button>
        <button
          type="button"
          onClick={performReload}
          disabled={!supported || busy}
          style={!supported || busy ? btnDisabledStyle : btnStyle}
        >
          Reload stored image
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!supported || busy}
          style={!supported || busy ? btnDisabledStyle : btnStyle}
        >
          Delete test image
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Original</div>
          {originalUrl ? (
            <img
              src={originalUrl}
              alt="original"
              style={{ width: "100%", height: "auto", borderRadius: 6, background: "#eee" }}
            />
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
            <img
              src={retrievedUrl}
              alt="retrieved"
              style={{ width: "100%", height: "auto", borderRadius: 6, background: "#eee" }}
              onError={() => setRenderError("<img> failed to render the retrieved Object URL")}
              onLoad={() => setRenderError(null)}
            />
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6 }}>(none)</div>
          )}
          {report.storedMeta && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <div>Stored MIME: {report.storedMeta.mimeType}</div>
              <div>Stored size: {report.storedMeta.sizeBytes.toLocaleString()} bytes</div>
              <div>Stored dim: {report.storedMeta.width}×{report.storedMeta.height}</div>
              <div>Created: {report.storedMeta.createdAt}</div>
            </div>
          )}
          {report.retrieved && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <div>Retrieved MIME: {report.retrieved.mimeType || "(empty)"}</div>
              <div>Retrieved size: {report.retrieved.sizeBytes.toLocaleString()} bytes</div>
            </div>
          )}
          {c && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <div>Last compress MIME: {c.mimeType}</div>
              <div>Last compress size: {c.sizeBytes.toLocaleString()} bytes</div>
              <div>Last compress dim: {c.width}×{c.height}</div>
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
        {report.errorStage && (
          <div style={{ color: "crimson" }}>
            Error stage: <b>{report.errorStage}</b>
            {report.errorName ? ` — ${report.errorName}` : ""}
            {report.errorMessage ? `: ${report.errorMessage}` : ""}
          </div>
        )}
        {renderError && <div style={{ color: "crimson" }}>Render: {renderError}</div>}
      </div>
    </div>
  );
}
