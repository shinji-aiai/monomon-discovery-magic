// Phase 0 — Isolated Photo-Immersion Feasibility Test route.
// Temporary, unlisted, no navigation link, no production imports.
// Delete this file after the Phase 0 report is complete.

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { generateImmersionImage, type ImmersionResult } from "@/lib/monomon-image.functions";

export const Route = createFileRoute("/phase0-immersion-test")({
  component: Phase0Test,
});

async function resizeToDataUrl(file: File, maxEdge = 1024, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function Phase0Test() {
  const run = useServerFn(generateImmersionImage);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImmersionResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [used, setUsed] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  const onPick = useCallback(async (f: File) => {
    setPrepError(null);
    setInputFile(f);
    try {
      const url = await resizeToDataUrl(f);
      setInputUrl(url);
    } catch (e) {
      setPrepError(String((e as Error)?.message ?? e));
    }
  }, []);

  const onRun = useCallback(async () => {
    if (!inputUrl || used) return;
    setUsed(true);
    setStatus("loading");
    try {
      const r = await run({ data: { photo: inputUrl } });
      setResult(r);
    } catch (e) {
      setResult({
        ok: false,
        status: 0,
        errorSummary: `Client threw: ${String((e as Error)?.message ?? e).slice(0, 200)}`,
        durationMs: 0,
      });
    } finally {
      setStatus("done");
    }
  }, [inputUrl, run, used]);

  const outputSrc =
    result?.ok ? `data:${result.detectedMime};base64,${result.base64}` : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Phase 0 — Immersion Feasibility Test</h1>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        One-shot. Exactly one paid image request per session. Not linked from anywhere in the app.
      </p>

      <div style={{ marginBottom: 12 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
          }}
          disabled={used}
        />
        {inputFile && (
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            {inputFile.name} — {(inputFile.size / 1024).toFixed(1)} KB
          </div>
        )}
        {prepError && <div style={{ color: "#b00", fontSize: 12 }}>Prep error: {prepError}</div>}
      </div>

      <button
        onClick={() => void onRun()}
        disabled={!inputUrl || used || status === "loading"}
        style={{
          padding: "8px 16px",
          background: used ? "#ccc" : "#111",
          color: "white",
          border: 0,
          borderRadius: 6,
          cursor: used ? "not-allowed" : "pointer",
        }}
      >
        {status === "loading" ? "Running…" : used ? "Used (one-shot)" : "Run test (1 paid request)"}
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Input (resized)</div>
          {inputUrl ? (
            <img src={inputUrl} alt="input" style={{ width: "100%", border: "1px solid #eee" }} />
          ) : (
            <div style={{ fontSize: 12, color: "#999" }}>Pick an image</div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Output</div>
          {outputSrc ? (
            <img src={outputSrc} alt="output" style={{ width: "100%", border: "1px solid #eee" }} />
          ) : (
            <div style={{ fontSize: 12, color: "#999" }}>—</div>
          )}
        </div>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Contract summary</div>
          <pre
            style={{
              fontSize: 11,
              background: "#f6f6f6",
              padding: 12,
              borderRadius: 6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(
              result.ok
                ? {
                    ok: true,
                    status: 200,
                    detectedMime: result.detectedMime,
                    responseContentType: result.responseContentType,
                    hasBase64Field: result.hasBase64Field,
                    payloadKeys: result.payloadKeys,
                    base64Length: result.base64Length,
                    base64Prefix: result.base64Prefix,
                    durationMs: result.durationMs,
                    requestId: result.requestId ?? null,
                  }
                : {
                    ok: false,
                    status: result.status,
                    errorSummary: result.errorSummary,
                    durationMs: result.durationMs,
                  },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
