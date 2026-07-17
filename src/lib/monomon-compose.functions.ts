/**
 * 撮影した実物写真に、極小のモノモンを自然に溶け込ませる合成パイプライン。
 *
 * 設計の一線（絶対に守る）：
 *  - 「ステッカー」「浮遊マスコット」「オーバーレイ」を絶対に作らない。
 *  - 元写真は改変せず、極小のモノモン＋その落とす影だけを追加する。
 *  - 光源方向・色温度・被写界深度・粒子ノイズ・遠近を元写真に一致させる。
 *  - モノは常に主役。モノモンは静かな発見（画面短辺の5〜20%）。
 *
 * 失敗を成功として扱わない：有効な合成画像を得られた場合だけ出会いを完成させる。
 *
 * モデル：google/gemini-3-pro-image
 *  Lovable AI Gateway 上で編集品質が最も高く、元画像の光・影・DoF の
 *  再現度が現行最強。/v1/images/generations に「messages + modalities」
 *  形式で POST し、Gateway が OpenAI-images 形式に正規化した
 *  data[0].b64_json を受け取る。
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** 配置の語彙。物体カテゴリから適切な位置を決めるための共通語彙。 */
export const PLACEMENT_VOCAB = [
  "inside",
  "peek_edge",
  "behind",
  "between",
  "under_rim",
  "in_fold",
  "on_handle",
  "on_lid",
  "in_pocket",
  "along_spine",
  "in_shadow",
] as const;
export type PlacementKind = (typeof PLACEMENT_VOCAB)[number];

export const ANCHOR_VOCAB = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;
export type AnchorKind = (typeof ANCHOR_VOCAB)[number];

export const POSE_HINT_VOCAB = [
  "peeking",
  "curled_sleeping",
  "hanging",
  "tucked",
  "leaning",
  "sitting",
  "hiding",
] as const;
export type PoseHint = (typeof POSE_HINT_VOCAB)[number];

const ComposeInput = z.object({
  /** 元写真（縮小済み data URL） */
  photo: z.string().min(16),
  /** モノモンの見た目を言葉で完全に指示するための材料 */
  spirit: z.object({
    object: z.string(), // 例: マグカップ
    speciesName: z.string(), // 例: マグ族
    palette: z.object({
      body: z.string(), // hsl / hex どちらでも
      accent: z.string(),
    }),
    eyes: z.string(), // "round" 等（表情語彙）
    mouth: z.string(),
    accessory: z.string(),
    /** 元画像の短辺に対する割合（0.05–0.20） */
    scale: z.number().min(0.03).max(0.25),
    placement: z.enum(PLACEMENT_VOCAB),
    anchor: z.enum(ANCHOR_VOCAB),
    poseHint: z.enum(POSE_HINT_VOCAB),
    /** AIが決めた「この物との具体的な触れ合い方」（英語短文）。最優先で従う。 */
    placementNote: z.string().optional().default(""),
  }),
});

export type ComposeResult =
  | {
      ok: true;
      dataUrl: string;
      mimeType: string;
      model: string;
      elapsedMs: number;
    }
  | {
      ok: false;
      reason: string;
      status?: number;
      model: string;
      errorType: string;
      elapsedMs: number;
      responseBody?: string;
    };

export const COMPOSITION_MODEL = "google/gemini-3-pro-image";
/** 画像編集はテキスト認識より長くかかるため、短いタイムアウトを共有しない。 */
const COMPOSE_TIMEOUT_MS = 120_000;

function safeErrorBody(body: string): string {
  return body.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[image omitted]").slice(0, 2_000);
}

/**
 * 物の種類から「自然な住処」の英語ヒントを返す。AIの placementNote が空でも
 * ステッカー配置に落ちないよう、確実に物と物理的に触れ合うガイドを与える。
 */
function fallbackHomeHint(object: string): string {
  const o = object.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => o.includes(k));
  const jp = object;
  const jhas = (...ks: string[]) => ks.some((k) => jp.includes(k));
  if (has("mug", "cup") || jhas("マグ", "カップ", "コップ", "湯呑"))
    return "peeking over the rim from inside the cup, tiny hands gripping the ceramic edge, most of the body hidden inside";
  if (has("plate", "dish", "bowl") || jhas("皿", "ボウル", "器"))
    return "if food remains, hiding behind or peeking from the food; if the plate is empty, curled up asleep on the inner rim of the plate, half tucked against the porcelain — never in a corner of the photo";
  if (has("book") || jhas("本", "ノート"))
    return "poking out from between two pages of the book, only eyes and the top of the head visible";
  if (has("remote") || jhas("リモコン"))
    return "tucked between the buttons of the remote, leaning against a button as if resting";
  if (has("keyboard") || jhas("キーボード"))
    return "peeking up from the gap between two keys, tiny hands on the keycap edges";
  if (has("pot", "plant") || jhas("鉢", "植木", "観葉"))
    return "peeking over the rim of the pot from the soil side, small hands on the pot edge";
  if (has("bag", "backpack") || jhas("鞄", "バッグ", "リュック"))
    return "peeking out from an open pocket or the top opening of the bag";
  if (has("shoe", "sneaker") || jhas("靴", "スニーカー"))
    return "peeking out from the opening of the shoe, resting on the inner edge";
  if (has("blanket", "towel") || jhas("布", "毛布", "タオル", "布団"))
    return "curled up asleep inside a soft fold of the fabric, only the top of the head visible";
  if (has("pillow") || jhas("枕", "クッション"))
    return "hiding beneath a corner of the pillow, only eyes peeking out";
  if (has("tissue") || jhas("ティッシュ"))
    return "peeking out from the tissue box opening, tiny hands on the plastic edge";
  return "tucked into or peeking from a natural nook of the object itself, physically touching the object, with most of the body hidden — never floating and never in a corner of the photo";
}

function buildInstruction(
  spirit: z.infer<typeof ComposeInput>["spirit"],
): string {
  const pct = Math.round(spirit.scale * 100);
  const home = spirit.placementNote?.trim() || fallbackHomeHint(spirit.object);
  return [
    `Edit the attached photograph of a ${spirit.object}. The photograph is the world — do not redraw it, do not restyle it, do not change composition, exposure, colors, or any other object. Reveal a single tiny living creature ("Monomon") that has always lived inside this specific ${spirit.object}.`,
    "",
    `THE OBJECT IS THE HERO. The ${spirit.object} must remain the visual main subject. The Monomon is a quiet secondary discovery a viewer notices only after seeing the object.`,
    "",
    "MONOMON SHARED DNA (every Monomon must feel like it belongs to the same world — apply ALL of these):",
    "- Tiny, gentle, safe, soothing presence. Never aggressive, never noisy, never a sticker, never a game mascot, never an anime character, never a Pokémon-like creature, never a humanoid, never a real animal.",
    "- Large, clear, refined eyes with soft catch-lights — the eyes carry the emotion.",
    "- Very small, restrained mouth (a tiny 'o', a faint smile, or closed). Never wide, never toothy.",
    "- Tiny soft hands, often gripping the edge of the object.",
    "- Soft rounded body, premium 3D material quality (like a beautifully crafted designer figure — Sonny Angel / Ghibli spirit level of craft), NOT flat illustration, NOT cel-shaded, NOT plastic-toy shiny.",
    "- Mostly hidden inside/behind the object — usually only eyes, top of head, tiny hands, and a hint of smile are visible.",
    "- A subtle natural motif is welcome (a small leaf, a sprout, a soft freckle pattern, a tiny bow) but OPTIONAL — do not force a leaf on every character.",
    "- Calm, soothing expression that makes the viewer want to quietly protect it.",
    "",
    "OBJECT-DRIVEN UNIQUENESS (this Monomon must be born from THIS specific object — never a reused template):",
    `- Derive body color, material feel, texture, freckles/markings, and personality from the ${spirit.object}'s own color, material, texture, shape, age, wear, and pattern.`,
    "- Ceramic → soft matte ceramic-like skin, calm muted palette. Wood → warm browns/beige with subtle grain-like freckles. Metal → cool silver-gray/charcoal with faint reflective sheen. Fabric → fuzzy felt-like texture, sleepy comforting mood. Colorful children's item → gentle accent from the object's colors, still quiet and refined. Glass → translucent pale tint with soft inner glow.",
    `- Suggested palette drawn from this object: body ${spirit.palette.body}, accent ${spirit.palette.accent} — tune these subtly to sit inside this photograph's light and color temperature.`,
    "- Vary body shape, eye shape, expression, pose, and any motif so this Monomon feels different from other Monomons. Possible expressions: shy, sleepy, curious, peaceful, quietly happy, slightly surprised, comforted. Possible poses: holding the rim, peeking with one eye, sleeping, resting, curled up, hiding behind a detail, looking upward, sitting quietly.",
    "",
    "STRICT anti-repetition rules (violating any of these = failure):",
    "- Do NOT default to a small round pale-blue creature. Do NOT recolor the same base character.",
    "- Do NOT put a cup-shaped hat or a green leaf sprout on every character. Motifs must be earned by the object.",
    "- Do NOT reuse the same face, same eye shape, same pose across different objects.",
    "- Do NOT generate famous characters, anime mascots, Pokémon-like creatures, monsters, or humanoids.",
    "",
    `WHERE THE CREATURE LIVES (follow this exactly):`,
    `- ${home}`,
    `- The Monomon MUST be physically touching or contained inside the ${spirit.object}. The ${spirit.object} is its home.`,
    `- Do NOT place it in a corner of the frame, on the background surface (table, floor, wall), or floating anywhere unrelated to the ${spirit.object}.`,
    `- Anchor guidance: near the ${spirit.anchor} of the frame ONLY IF that is where the ${spirit.object} actually is; otherwise follow the object.`,
    `- Size: approximately ${pct}% of the image's short edge — very small, a quiet discovery, never larger than the object.`,
    `- Pose reference: ${spirit.poseHint}, oriented so it clearly interacts with the ${spirit.object}.`,
    "",
    "MANDATORY photo integration — the Monomon must match the photograph's:",
    "- Light source direction and color temperature",
    "- Shadow softness/direction, casting a matching soft contact shadow onto the surface it touches",
    "- Depth of field and lens blur at the creature's depth plane (blur it if that plane is out of focus)",
    "- Film grain, sensor noise, micro-contrast",
    "- Perspective, vanishing lines, and scale relative to the object",
    "- Material response: subtle reflections, occlusions, or contact where the Monomon meets the object",
    "",
    "STRICT prohibitions — the output is a failure if any of these are present:",
    "- Sticker, icon, cartoon outline, cel-shading, glow, halo, sparkles, drop shadow, 2D pasted look",
    "- A creature floating in front of the object with no contact, or placed in a corner / on the background",
    "- The creature being the visual main subject or larger than the object",
    "- Changing crop, framing, exposure, color grade, background, or any other object",
    "- Text, logos, watermarks, borders, frames, vignettes",
    "",
    "SELF-CHECK before returning the image, silently ask:",
    `1. Does this Monomon feel uniquely born from THIS ${spirit.object} (color, material, texture) — not a reused template?`,
    `2. Does it still clearly belong to the Monomon family (tiny, gentle, large clear eyes, tiny mouth, mostly hidden, premium 3D craft)?`,
    `3. Is the ${spirit.object} still the main subject, and is the Monomon physically contained by or touching it?`,
    "4. Would a first-time viewer believe this is one single real photograph and want to quietly protect the creature?",
    "If any answer is no, recompose before returning.",
    "",
    "Output: the ENTIRE original photograph unchanged, same aspect ratio and framing, with only the tiny Monomon (and its own soft contact shadow) newly present as if it has always lived inside the object. It must still look like one real photograph.",
  ].join("\n");
}



export const composeMonomonScene = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ComposeInput.parse(input))
  .handler(async ({ data }): Promise<ComposeResult> => {
    const startedAt = Date.now();
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return {
        ok: false,
        reason: "LOVABLE_API_KEY is unavailable",
        model: COMPOSITION_MODEL,
        errorType: "configuration",
        elapsedMs: Date.now() - startedAt,
      };
    }

    const instruction = buildInstruction(data.spirit);
    const mimeType = /^data:([^;,]+);base64,/.exec(data.photo)?.[1] ?? "unknown";
    const imageBytes = Math.floor(((data.photo.split(",")[1]?.length ?? 0) * 3) / 4);
    console.info("[monomon-pipeline]", {
      stage: "COMPOSITION_REQUEST_STARTED",
      model: COMPOSITION_MODEL,
      inputMimeType: mimeType,
      inputImageBytes: imageBytes,
    });

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), COMPOSE_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(
        "https://ai.gateway.lovable.dev/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: COMPOSITION_MODEL,
            modalities: ["image", "text"],
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: instruction },
                  {
                    type: "image_url",
                    image_url: { url: data.photo },
                  },
                ],
              },
            ],
          }),
        },
      );
    } catch (e) {
      clearTimeout(to);
      const reason =
        e instanceof Error && e.name === "AbortError" ? "timeout" : "network";
      const elapsedMs = Date.now() - startedAt;
      console.error("[monomon-pipeline]", {
        failedStage: "COMPOSITION_REQUEST_STARTED",
        model: COMPOSITION_MODEL,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorType: reason,
        elapsedMs,
        inputMimeType: mimeType,
        inputImageBytes: imageBytes,
      });
      return { ok: false, reason, model: COMPOSITION_MODEL, errorType: reason, elapsedMs };
    }
    clearTimeout(to);

    console.info("[monomon-pipeline]", {
      stage: "COMPOSITION_RESPONSE_RECEIVED",
      status: res.status,
      model: COMPOSITION_MODEL,
      elapsedMs: Date.now() - startedAt,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const responseBody = safeErrorBody(body);
      let errorType = `http_${res.status}`;
      try {
        const parsed = JSON.parse(body) as { type?: string };
        if (parsed.type) errorType = parsed.type;
      } catch {
        // HTTP status remains the diagnostic type when the body is not JSON.
      }
      const elapsedMs = Date.now() - startedAt;
      console.error("[monomon-pipeline]", {
        failedStage: "COMPOSITION_RESPONSE_RECEIVED",
        status: res.status,
        model: COMPOSITION_MODEL,
        responseBody,
        errorMessage: `Gateway returned HTTP ${res.status}`,
        errorType,
        elapsedMs,
        inputMimeType: mimeType,
        inputImageBytes: imageBytes,
      });
      return {
        ok: false,
        reason: errorType,
        status: res.status,
        model: COMPOSITION_MODEL,
        errorType,
        elapsedMs,
        responseBody,
      };
    }

    let b64: string | undefined;
    try {
      const json = (await res.json()) as {
        data?: { b64_json?: string }[];
      };
      b64 = json.data?.[0]?.b64_json;
    } catch (e) {
      const elapsedMs = Date.now() - startedAt;
      console.error("[monomon-pipeline]", {
        failedStage: "GENERATED_IMAGE_PARSED",
        status: res.status,
        model: COMPOSITION_MODEL,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorType: "response_parse",
        elapsedMs,
        inputMimeType: mimeType,
        inputImageBytes: imageBytes,
      });
      return {
        ok: false,
        reason: "response_parse",
        status: res.status,
        model: COMPOSITION_MODEL,
        errorType: "response_parse",
        elapsedMs,
      };
    }
    if (!b64 || b64.length < 1000) {
      const elapsedMs = Date.now() - startedAt;
      console.error("[monomon-pipeline]", {
        failedStage: "GENERATED_IMAGE_PARSED",
        status: res.status,
        model: COMPOSITION_MODEL,
        errorMessage: "Response did not contain data[0].b64_json",
        errorType: "empty_image",
        elapsedMs,
        inputMimeType: mimeType,
        inputImageBytes: imageBytes,
      });
      return {
        ok: false,
        reason: "empty_image",
        status: res.status,
        model: COMPOSITION_MODEL,
        errorType: "empty_image",
        elapsedMs,
      };
    }

    console.info("[monomon-pipeline]", {
      stage: "GENERATED_IMAGE_PARSED",
      status: res.status,
      model: COMPOSITION_MODEL,
      outputImageBytes: Math.floor((b64.length * 3) / 4),
      elapsedMs: Date.now() - startedAt,
    });
    return {
      ok: true,
      dataUrl: `data:image/png;base64,${b64}`,
      mimeType: "image/png",
      model: COMPOSITION_MODEL,
      elapsedMs: Date.now() - startedAt,
    };
  });
