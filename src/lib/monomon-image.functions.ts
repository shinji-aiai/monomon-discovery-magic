// Phase 0 — Isolated Photo-Immersion Feasibility Test
// One-shot server function that POSTs to the Lovable AI Gateway image endpoint
// (google/gemini-3.1-flash-image) with a user-supplied photograph and returns
// either the generated image (base64 + detected MIME) or a redacted error DTO.
//
// No retries, no streaming, no caching. Not imported by any production module.
// Verified contract: (to be filled in after the Phase 0 test run)

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  photo: z
    .string()
    .min(64)
    .refine((s) => s.startsWith("data:image/"), "photo must be a data:image/* URL"),
});

export type ImmersionResult =
  | {
      ok: true;
      base64: string;
      detectedMime: string;
      responseContentType: string | null;
      hasBase64Field: boolean;
      payloadKeys: string[];
      base64Length: number;
      base64Prefix: string;
      durationMs: number;
      requestId?: string;
    }
  | {
      ok: false;
      status: number;
      errorSummary: string;
      durationMs: number;
    };

const PROMPT_TEXT =
  "Edit this photograph. Preserve the original mug, table surface, lighting, " +
  "camera angle, focal length, colors, mug pattern, and background exactly. " +
  "Do not restyle, recolor, or re-illuminate the scene. Add one small soft " +
  "round pastel creature (a Monomon) about the size of a grape peeking " +
  "naturally from inside the mug's opening. The creature must look physically " +
  "present in the same lighting and cast a soft shadow consistent with the " +
  "scene. Do not add text, logos, borders, watermarks, or other objects.";

function detectMimeFromBase64(b64: string): string {
  try {
    // Decode only the first ~24 bytes for magic sniffing.
    const head = b64.slice(0, 64);
    const bin = atob(head);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    if (
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
    ) return "image/png";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    if (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    ) return "image/webp";
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
    return "application/octet-stream";
  } catch {
    return "application/octet-stream";
  }
}

function redact(s: string): string {
  return s
    .replace(/sb_[a-z]+_[A-Za-z0-9_\-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/[A-Fa-f0-9]{40,}/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=]{80,}/g, "[redacted-b64]");
}

function summarizeError(raw: string, fallback: string): string {
  const cleaned = redact(raw).replace(/\s+/g, " ").trim();
  const s = cleaned.length > 0 ? cleaned : fallback;
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

export const generateImmersionImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ImmersionResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      console.error("[phase0] Missing LOVABLE_API_KEY");
      return { ok: false, status: 0, errorSummary: "Missing LOVABLE_API_KEY on server", durationMs: 0 };
    }

    const body = {
      model: "google/gemini-3.1-flash-image",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT_TEXT },
            { type: "image_url", image_url: { url: data.photo } },
          ],
        },
      ],
      modalities: ["image", "text"],
    };

    const started = performance.now();
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const durationMs = Math.round(performance.now() - started);
      console.error("[phase0] fetch threw", e);
      return {
        ok: false,
        status: 0,
        errorSummary: summarizeError(String((e as Error)?.message ?? e), "network error"),
        durationMs,
      };
    }

    const durationMs = Math.round(performance.now() - started);
    const responseContentType = res.headers.get("content-type");
    const requestId =
      res.headers.get("x-lovable-aig-run-id") ??
      res.headers.get("x-lovable-aig-log-id") ??
      undefined;
    const rawText = await res.text();

    if (!res.ok) {
      console.error("[phase0] non-2xx", {
        status: res.status,
        contentType: responseContentType,
        requestId,
        bodyPreview: rawText.slice(0, 2048),
      });
      return {
        ok: false,
        status: res.status,
        errorSummary: summarizeError(rawText, `HTTP ${res.status}`),
        durationMs,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[phase0] non-JSON success body", { contentType: responseContentType, preview: rawText.slice(0, 512) });
      return { ok: false, status: res.status, errorSummary: "Response was not JSON", durationMs };
    }

    const dataArr = (parsed as { data?: Array<Record<string, unknown>> })?.data;
    const first = Array.isArray(dataArr) ? dataArr[0] : undefined;
    const payloadKeys = first ? Object.keys(first) : [];
    const b64Raw = first && typeof first.b64_json === "string" ? (first.b64_json as string) : "";
    const hasBase64Field = b64Raw.length > 0;

    if (!hasBase64Field) {
      console.error("[phase0] missing b64_json", { payloadKeys, topKeys: Object.keys(parsed as object) });
      return {
        ok: false,
        status: res.status,
        errorSummary: `Missing data[0].b64_json. Keys: ${payloadKeys.join(",")}`,
        durationMs,
      };
    }

    const detectedMime = detectMimeFromBase64(b64Raw);

    return {
      ok: true,
      base64: b64Raw,
      detectedMime,
      responseContentType,
      hasBase64Field,
      payloadKeys,
      base64Length: b64Raw.length,
      base64Prefix: b64Raw.slice(0, 16),
      durationMs,
      requestId,
    };
  });
