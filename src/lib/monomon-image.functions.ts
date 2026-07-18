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
//
// Phase 1C-R (universal Monomon character identity lock — 2026-07-18):
// the universal four-strategy geometry placement system passed the
// thin-solid-object boundary test (photograph preserved, EDGE strategy
// correctly selected, natural occlusion, no invented opening, real object
// remained the hero). Character identity FAILED because the generated
// character read as a human baby / doll / small monkey. This refinement
// PRESERVES the four-strategy placement architecture intact and ONLY
// strengthens the universal, non-biological Monomon morphology rules
// (silhouette lock, material lock, color lock, negative identity check).
// No per-object prompt or branching is introduced. Endpoint, model,
// auth, request/response contract, MIME detection, DTOs and error
// handling remain unchanged.
//
// Phase 1C-F (final universal placement policy — 2026-07-18):
// controlled results confirmed universal photograph preservation PASS,
// non-biological Monomon identity PASS, OPENING placement PASS with a
// container object, and physically-touching BESIDE placement PASS with
// a thin solid object (quiet companion feeling, object remained the
// hero). The prior numeric "~65% hidden" rule was rejected as
// unnecessarily rigid for arbitrary real-world objects, and mandatory
// EDGE selection was rejected as too restrictive. This refinement
// consolidates ONE universal geometry-aware placement policy with five
// permitted relationships (OPENING, EXISTING GAP, EDGE, UNDER,
// TOUCHING BESIDE); TOUCHING BESIDE is now a valid controlled strategy
// with strict size, contact, surface, shadow and object-dominance
// rules. No per-object prompts or branching are introduced. The full
// Phase 1C-R character-identity lock, photograph-preservation and
// object-as-hero rules, endpoint, model, auth, request/response
// contract, MIME detection, DTOs and error handling all remain
// byte-identical to the verified baseline.

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
  "exactly ONE of the following four universal strategies in this strict",
  "priority order. Do not invent a fifth strategy. Whichever strategy is",
  "chosen, the real object must perform the occlusion and must remain",
  "completely preserved.",
  "",
  "PRIORITY 1 — OPENING. Choose OPENING only when the object already has a",
  "genuine existing cavity that can naturally hide most of the Monomon.",
  "Peek from that existing opening with most of the body hidden inside;",
  "the real existing edge must perform the occlusion. Never create,",
  "enlarge, reshape or invent an opening.",
  "",
  "PRIORITY 2 — EXISTING GAP. Choose EXISTING GAP only when the object",
  "already has a real handle, frame, gap or structural space that can",
  "naturally hide most of the Monomon without modifying the object. Peek",
  "through or from behind that existing space, preserving its exact size",
  "and geometry. Never reshape, enlarge or invent a gap.",
  "",
  "PRIORITY 3 — EDGE. EDGE is MANDATORY for a small or medium thin, flat",
  "or solid object when (a) no usable opening or real gap exists and",
  "(b) at least one visible side edge or corner can hide the character.",
  "When these conditions are true, do NOT choose UNDER OR TOUCHING BESIDE.",
  "Place the Monomon physically behind one existing side edge or corner.",
  "The character must overlap the object silhouette in the final image.",
  "The center of the Monomon's body must remain behind the object. At",
  "least approximately 65% of the Monomon's total form must be hidden by",
  "the real object. Show only the upper face, eyes, a small top portion",
  "of the body and optionally two tiny rounded hands. Do NOT show the",
  "complete body. Do NOT show the lower body. Do NOT place the entire",
  "character outside the object silhouette. Do NOT place it next to the",
  "object with only slight contact. The real object must visibly occlude",
  "the character. Preserve the exact object edge and geometry. Tiny hands",
  "may touch the existing edge, but must not cover buttons, text, labels",
  "or important details. The character must feel as though it was already",
  "hiding behind the object. The final 2D composition must clearly",
  "communicate \"mostly hidden behind the real object\" and NOT \"standing",
  "beside the real object.\" Never invent a door, window, crack, pocket",
  "or hole.",
  "",
  "For OPENING and EXISTING GAP, at least approximately 65% of the",
  "character must also remain hidden. Show primarily the face, eyes and",
  "optionally tiny hands. The real existing edge or structure must",
  "perform the occlusion. Never enlarge, reshape or invent an opening",
  "or gap.",
  "",
  "PRIORITY 4 — UNDER OR TOUCHING BESIDE. This is a STRICT LAST-RESORT",
  "strategy. Use it only when (a) the object is large, furniture-sized",
  "or vertically structured, or (b) no visible opening, usable gap, side",
  "edge, corner or underside can physically hide the character because",
  "of the crop or geometry. Do NOT choose TOUCHING BESIDE merely because",
  "it is easier to render. For small or medium objects, a fully visible",
  "character beside the object is FORBIDDEN whenever an existing edge",
  "can provide believable occlusion. UNDER is preferred over TOUCHING",
  "BESIDE whenever the lower edge or underside can hide the character.",
  "If TOUCHING BESIDE is truly the only physically believable option:",
  "the character must remain extremely small; it must visibly touch the",
  "object; part of its form must still be obscured by the object, its",
  "shadow or a real structural edge where possible; it must not stand",
  "fully exposed in an empty area; it must not become a second visual",
  "subject; and the real object must remain overwhelmingly dominant.",
  "Maintain believable surface or floor contact and never float.",
  "",
  "Final placement check — before finalizing the image, verify: (1) a",
  "genuine OPENING or EXISTING GAP was not overlooked; (2) for a thin,",
  "flat or solid object, EDGE was selected whenever a visible edge or",
  "corner could hide the character; (3) at least approximately 65% of",
  "the character is hidden whenever OPENING, EDGE or EXISTING GAP is",
  "used; (4) the character is not fully visible beside a small or medium",
  "object; (5) the character overlaps or is physically occluded by the",
  "real object; (6) the object remains the hero. If the proposed result",
  "shows most or all of the character beside a small or medium object,",
  "reposition ONLY the Monomon behind an existing edge or corner. Do NOT",
  "alter the original object or photograph during this correction.",
  "",
  "Monomon visual DNA — the character is a NON-BIOLOGICAL spirit form, not",
  "a creature and not a person. Silhouette: one continuous rounded seed,",
  "pebble, droplet or short capsule shape that reads as a single soft",
  "head-body form. There is NO separate head, neck, shoulders, torso or",
  "hips; no human skull or baby-head proportions; no jawline; no facial",
  "planes; no cranium-plus-neck structure; no animal ears; no nose bridge.",
  "Surface: smooth matte clay, soft ceramic, paper-mâché, velvety matte",
  "resin or a subtly handcrafted material — never skin, flesh, pores,",
  "wrinkles, wet tissue, fur, animal hair, fuzzy plush fabric or any",
  "photoreal biological texture. Face contains ONLY two simple large dark",
  "oval or bead-like eyes (no visible white sclera, no realistic iris, no",
  "realistic pupil anatomy) each with one small soft highlight, and one",
  "extremely small dot or short curved-line mouth. There is NO nose, no",
  "nostrils, no muzzle, no snout, no eyebrows, no eyelashes, no human",
  "eyelids, no human cheeks, no lips and no teeth. Hands, when naturally",
  "visible, are two tiny rounded nubs or mitten-like forms with no",
  "fingers, no nails and no human anatomy; no long arms, no legs, no",
  "standing baby-like posture, no full humanoid pose. Most of the form",
  "stays hidden by the real object. Expression is calm, gentle, slightly",
  "shy, protective and quietly curious, conveyed ONLY through eye",
  "direction, eye spacing, the tiny mouth curve, a subtle head-body tilt",
  "and small hand placement — never through human facial expression.",
  "",
  "Color lock: use one dominant soft matte color plus at most one",
  "restrained accent, subtly derived from the photographed object. Prefer",
  "cool cream, muted lavender, pale blue-gray, soft sage, dusty pastel or",
  "another clearly non-skin material color. NEVER default to flesh pink,",
  "peach skin, tan skin, realistic beige skin, reddish-brown skin or",
  "monkey-brown skin. When the object is black, white, gray, brown or",
  "otherwise neutral, translate its palette into a soft non-biological",
  "material color rather than realistic skin. Never copy a logo, brand",
  "mark or readable text onto the character. Never add multiple",
  "accessories. At most one tiny handcrafted-looking natural motif is",
  "allowed (a single small sprout, small leaf or soft clay tuft) and it",
  "must also read as non-biological.",
  "",
  "Identity from the object: the palette and optionally one subtle",
  "material, pattern or shape cue may echo the real object so the Monomon",
  "feels related to it while keeping the same Monomon visual family",
  "across different objects. The object is NOT transformed into the",
  "character and the character is NOT a miniature copy of the object.",
  "",
  "Final identity check — before producing the result, verify the Monomon",
  "does NOT resemble any of: a human, a human baby, a doll, a monkey or",
  "ape, a bear, a cat, a rabbit, a mouse, a hamster, a dog, any",
  "recognizable animal, a plush toy, a generic mobile-game mascot or a",
  "sticker. If it does, redesign ONLY the character into a simple",
  "non-biological seed, pebble, droplet or capsule spirit while keeping",
  "the selected placement strategy and preserving the original",
  "photograph exactly. Do NOT overcorrect into an abstract glowing orb,",
  "featureless blob, ghost sheet, floating light, geometric icon or flat",
  "sticker — the Monomon must still have two gentle bead-like eyes, a",
  "tiny mouth, tiny rounded hands when naturally visible, a readable",
  "emotional presence, premium soft 3D volume and physically believable",
  "placement, occlusion and contact shadow.",
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
