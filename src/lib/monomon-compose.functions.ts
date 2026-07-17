/**
 * 撮影した実物写真に、極小のモノモンを自然に溶け込ませる合成パイプライン。
 *
 * 設計の一線（絶対に守る）：
 *  - 「ステッカー」「浮遊マスコット」「オーバーレイ」を絶対に作らない。
 *  - 元写真は改変せず、極小のモノモン＋その落とす影だけを追加する。
 *  - 光源方向・色温度・被写界深度・粒子ノイズ・遠近を元写真に一致させる。
 *  - モノは常に主役。モノモンは静かな発見（画面短辺の5〜20%）。
 *
 * 失敗は許容：合成できなくても発見体験は元写真のみで完結する。
 * 何度も呼び出さない：同じ個体につき1回の合成のみ（呼び出し側で担保）。
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
  }),
});

export type ComposeResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: string };

/** モデル呼び出しの最大待ち時間（ミリ秒）。超えたら諦めて元写真で成立。 */
const COMPOSE_TIMEOUT_MS = 28_000;

function buildInstruction(
  spirit: z.infer<typeof ComposeInput>["spirit"],
): string {
  const pct = Math.round(spirit.scale * 100);
  return [
    "Edit the attached photograph. Insert a single tiny living creature into the scene.",
    "",
    `Creature description:`,
    `- Silhouette family: ${spirit.speciesName} — small round soft-bodied character with subtle nods to a ${spirit.object}.`,
    `- Size: approximately ${pct}% of the image's short edge. Very small — a quiet discovery, never dominant.`,
    `- Body: soft matte finish, main color ${spirit.palette.body}, gentle accent ${spirit.palette.accent}.`,
    `- Face: ${spirit.eyes} eyes, ${spirit.mouth} mouth, expression calm and warm.`,
    `- Accessory: ${spirit.accessory === "none" ? "none" : spirit.accessory}.`,
    `- Pose: ${spirit.poseHint}.`,
    "",
    `Placement in the scene:`,
    `- Position it "${spirit.placement}" relative to the main ${spirit.object}, anchored toward the ${spirit.anchor} of the frame.`,
    `- It must appear to genuinely occupy that spot in three-dimensional space (inside, behind, tucked into, or peeking from the real object — never floating in front of it).`,
    "",
    "MANDATORY physical integration — the creature must match the photograph's:",
    "- Existing light source direction and color temperature",
    "- Shadow softness and direction (cast a matching soft contact shadow onto the surface it touches)",
    "- Depth of field and lens blur at the creature's depth plane",
    "- Film grain, sensor noise, and micro-contrast",
    "- Perspective, vanishing lines, and scale relative to nearby objects",
    "- Material response: subtle reflections or occlusions where the creature meets the object",
    "",
    "STRICT prohibitions — reject any of the following:",
    "- Stickers, cartoon outlines, glowing halos, sparkles, cel-shading, drop shadows, or 2D pasted look",
    "- A mascot floating in front of the object with no contact or shadow",
    "- Any change to the rest of the image (crop, color grade, exposure, other objects, background)",
    "- Text, logos, watermarks, borders, frames",
    "- Adding or altering any object other than the single tiny creature and its own contact shadow",
    "",
    "Output the ENTIRE original photograph unchanged, at the same aspect ratio and framing, with only the tiny creature (and its own soft contact shadow) newly present as if it had always lived there. The photograph must still look like a single real photograph.",
  ].join("\n");
}

export const composeMonomonScene = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ComposeInput.parse(input))
  .handler(async ({ data }): Promise<ComposeResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, reason: "no_key" };

    const instruction = buildInstruction(data.spirit);

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
            model: "google/gemini-3-pro-image",
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
      console.error("[monomon-compose] fetch failed", reason, e);
      return { ok: false, reason };
    }
    clearTimeout(to);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[monomon-compose] gateway error", res.status, body);
      if (res.status === 429) return { ok: false, reason: "rate_limit" };
      if (res.status === 402) return { ok: false, reason: "credits" };
      return { ok: false, reason: `http_${res.status}` };
    }

    let b64: string | undefined;
    try {
      const json = (await res.json()) as {
        data?: { b64_json?: string }[];
      };
      b64 = json.data?.[0]?.b64_json;
    } catch (e) {
      console.error("[monomon-compose] parse failed", e);
      return { ok: false, reason: "parse" };
    }
    if (!b64 || b64.length < 1000) {
      return { ok: false, reason: "empty_image" };
    }

    return { ok: true, dataUrl: `data:image/png;base64,${b64}` };
  });
