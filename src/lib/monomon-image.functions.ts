// Phase 0 — Isolated Photo-Immersion Feasibility Test
// One-shot server function that POSTs to the Lovable AI Gateway image endpoint
// (google/gemini-3.1-flash-image) with a user-supplied photograph and returns
// either the generated image (base64 + detected MIME) or a redacted error DTO.
//
// No retries, no streaming, no caching. Not imported by any production module.
//
// Verified contract (Phase 0 — 2026-07-18, PASS):
//   Endpoint : POST https://ai.gateway.lovable.dev/v1/images/generations
//   Model    : google/gemini-3.1-flash-image
//   Auth     : Lovable-API-Key header (server-side LOVABLE_API_KEY)
//   Request  : chat-shaped { messages:[{ role:"user", content:[text, image_url] }],
//              modalities:["image","text"] }
//   Response : JSON, data[0].b64_json (image/png)
//   Cost     : ~0.27126 Lovable credits per call
//   Latency  : ~12.1 s
//   Scene    : original photograph and mug preserved successfully
//
// Phase 1A (character style calibration — 2026-07-18, PASS): a mug-specific
// prompt established the Monomon visual DNA against a single test photograph.
//
// Phase 1C (universal object-geometry placement — 2026-07-18): the Phase 1A
// mug-specific prompt has been replaced by ONE object-agnostic, geometry-based
// placement prompt intended to support arbitrary real-world objects. The model
// inspects the photographed object's real geometry at runtime and picks one of
// four placement strategies (opening / edge / existing gap / under-or-beside).
// A thin solid object will be used only as a representative boundary test on
// the existing /phase0-immersion-test route; this phase does NOT introduce
// per-object prompts. The endpoint, model, headers, request structure,
// response parsing, MIME detection, error handling, and DTO types remain
// intentionally unchanged from the verified Phase 0 contract.

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


const PROMPT_TEXT = [
  "Edit this photograph. Do not regenerate the scene. The photographed real",
  "object must remain the hero and stay visually dominant. Preserve exactly:",
  "the main object's shape and proportions, every button, label, logo and",
  "piece of readable text, all colors and materials, scratches, reflections",
  "and surface details, every surrounding object, the background, the crop,",
  "camera angle, perspective, focal length, lighting direction, color",
  "temperature, shadow softness, focus, depth of field and photographic",
  "grain. Add to the photograph rather than recreate it. Do not move,",
  "replace, redesign, restyle or relight the object or the scene. Do not",
  "alter buttons, labels or readable text. Do not add decorative scenery,",
  "sparkles, captions, borders, logos or watermarks.",
  "",
  "Add exactly one tiny original spirit character (a Monomon) that quietly",
  "lives in, behind, beneath or immediately beside the real object. The",
  "Monomon is NOT the real object transformed into a character and must not",
  "be a miniature copy of it — do not anthropomorphize the object.",
  "",
  "Placement — first inspect the real object's actual geometry, then choose",
  "exactly ONE of the following strategies (only one, whichever hides most",
  "of the character most naturally while preserving the object completely):",
  "",
  "1. OPENING — only when the object already has a genuine opening or",
  "cavity. Peek from that existing opening with most of the body hidden",
  "inside; tiny hands may touch the existing edge; the real edge must",
  "occlude the hidden body. Never create or enlarge an opening.",
  "",
  "2. EDGE — for thin, flat or solid objects with no usable opening. Peek",
  "from behind one existing side edge or corner with most of the body",
  "hidden behind the object; tiny hands may gently touch the existing edge;",
  "the real object must occlude the hidden body. Do not place the complete",
  "character on top of the object. Never invent a door, window, crack,",
  "pocket or hole.",
  "",
  "3. EXISTING GAP — only when the object already has a real gap, handle,",
  "frame or structural space. Peek through or from behind that existing",
  "space, preserving its exact size and geometry. Never reshape the gap.",
  "",
  "4. UNDER OR TOUCHING BESIDE — for large objects, furniture or cases",
  "where the other strategies are physically implausible. Peek from beneath",
  "or behind a real edge, or remain immediately beside the object while",
  "visibly touching it. Keep the character very small relative to the",
  "object, maintain believable surface or floor contact, and never float.",
  "",
  "Monomon visual DNA (apply all): tiny scale; soft rounded non-animal",
  "silhouette; large clear gentle eyes; a very small restrained mouth; two",
  "tiny short hands only when naturally visible; a calm, protective,",
  "slightly shy expression; quiet presence; premium soft 3D rendering with",
  "a matte ceramic, felt or handcrafted texture; minimal facial detail;",
  "most of the body hidden; no energetic action pose. It must not resemble",
  "a recognizable animal (no bear, cat, rabbit, mouse, hamster or dog), a",
  "plush toy, a human baby, a generic mobile-game mascot, a sticker, or a",
  "miniature copy of the photographed object. At most one subtle natural",
  "motif is allowed (a single tiny sprout, leaf or soft tuft).",
  "",
  "Identity from the object: derive a restrained palette from the real",
  "object and optionally echo one subtle material, pattern or shape cue so",
  "the Monomon feels related to it while keeping the same Monomon visual",
  "family across different objects. Never copy a logo, brand mark or",
  "readable text onto the character. Never add multiple accessories.",
  "",
  "Match the photograph's perspective, focus, grain, lighting direction and",
  "shadow softness so the Monomon feels physically present. It may cast",
  "only a subtle, physically consistent contact shadow. Do not add a second",
  "character.",
].join(" ");



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
