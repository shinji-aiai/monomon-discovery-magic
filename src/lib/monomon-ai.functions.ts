import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SPECIES } from "./species";
import {
  ACCESSORY_POOL,
  EYE_POOL,
  MOUTH_POOL,
  type Accessory,
  type EyeStyle,
  type MouthStyle,
} from "./monomon-data";

/**
 * 写真に写った「モノ」をAIが認識し、そのモノに本当に宿りそうな精霊を組み立てます。
 *
 * 設計方針（最優先＝納得感）：
 *  - ランダム生成は禁止。見た目・名前・性格・説明文は必ず認識した物に一致させる。
 *  - 関連性が弱い／自信が低いときは uncertain=true を返し、UIで「○○の仲間かもしれない」と伝える。
 *  - 説明文には、そのモノの役割や特徴を必ず反映する（例：コップ→水を大切にする）。
 */

/** AIが返す精霊データ（描画はこの speciesId に対応する手続き的SVG）。 */
export interface SpiritAnalysis {
  /** 認識した物体（日本語・短く） 例: "コップ" "ハサミ" "傘" */
  object: string;
  /** 姿に使う種族ID（既知の SPECIES のいずれか。最も形が近いもの） */
  speciesId: string;
  /** 認識に十分な自信があるか（false のとき UI は推定表現にする） */
  confident: boolean;
  /** 物の色をふまえた色相 0-360 */
  hue: number;
  eyes: EyeStyle;
  mouth: MouthStyle;
  accessory: Accessory;
  /** 世界にひとつの呼び名（物にちなんだ語感） */
  name: string;
  /** 物の役割からくる性格（短く） */
  personality: string;
  /** 物の役割・特徴を反映した一言説明（短くてよい） */
  description: string;
}

const EYE_SET = new Set<string>(EYE_POOL);
const MOUTH_SET = new Set<string>(MOUTH_POOL);
const ACC_SET = new Set<string>(ACCESSORY_POOL);

const AnalyzeInput = z.object({
  /** ダウンスケール済みの画像 data URL（image/jpeg|png） */
  photo: z.string().min(16),
});

function buildSpeciesCatalog(): string {
  return SPECIES.map((s) => `- ${s.id}：${s.name}（${s.emoji}）`).join("\n");
}

const SYSTEM_PROMPT = `あなたは「身近な物に宿る精霊」を見抜く鑑定士です。
ユーザーが撮影した写真を注意深く観察し、写っている「主役のモノ」を正確に特定します。
そのモノの役割・使われ方・特徴から、本当にそこに宿っていそうな精霊を1体だけ導きます。

絶対のルール：
1. 見た目・名前・性格・説明文は、必ず認識した物と結びつけること。無関係な可愛さだけのキャラは禁止。
2. ランダムに決めない。なぜその精霊なのか、物の役割から説明できる内容にする。
3. 説明文には、その物の「役割・特徴」を必ず反映する。
   例) コップ→水を大切にする / ハサミ→切ることが好き / 時計→時間を守る / 傘→雨の日に元気 / 靴→旅を愛する
4. 姿(speciesId)は、下の一覧から「写っている物に形が最も近いもの」を選ぶ。
5. 物の判別に自信がない、または一覧に近い形がない場合は confident=false にする（嘘をつかない）。
6. ユーザーが3秒で「なるほど、確かにこの精霊っぽい！」と納得できることを最優先にする。

姿に使える種族(speciesId)一覧：
{{CATALOG}}

目(eyes)は次から1つ: round, sparkle, dot, oval, wink, closed, sleepy, starry, cross
口(mouth)は次から1つ: smile, open, cat, small, grin, ooh, tongue
飾り(accessory)は次から1つ: none, leaf, bow, star, antenna, flower, crown, halo, hat
目・口・飾りは、その物・性格に合うものを選ぶ（迷ったら none / smile / round）。

必ず次のJSONだけを返す（前後に文章を付けない）:
{
  "object": "認識した物（日本語・短く）",
  "speciesId": "一覧のいずれかのID",
  "confident": true または false,
  "hue": 0〜360の整数,
  "eyes": "...", "mouth": "...", "accessory": "...",
  "name": "物にちなんだ呼び名（カタカナ中心・短く）",
  "personality": "物の役割からくる性格（短く・8文字程度）",
  "description": "物の役割や特徴を反映した一言（短くてよい・全角20文字程度）"
}`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI応答にJSONが見つかりません");
  return JSON.parse(raw.slice(start, end + 1));
}

export const analyzeSpirit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<SpiritAnalysis | { error: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AIキーが設定されていません" };

    const speciesIds = new Set(SPECIES.map((s) => s.id));
    const system = SYSTEM_PROMPT.replace("{{CATALOG}}", buildSpeciesCatalog());

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "この写真の主役のモノを認識し、ルールに従って宿る精霊をJSONで返してください。",
                },
                { type: "image_url", image_url: { url: data.photo } },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      console.error("AI gateway fetch failed", e);
      return { error: "AIに接続できませんでした" };
    }

    if (res.status === 429) return { error: "rate_limit" };
    if (res.status === 402) return { error: "credits" };
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      return { error: "AIの解析に失敗しました" };
    }

    let parsed: Record<string, unknown>;
    try {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      parsed = extractJson(content) as Record<string, unknown>;
    } catch (e) {
      console.error("AI parse failed", e);
      return { error: "AIの応答を解釈できませんでした" };
    }

    // --- 検証・正規化（許可外の値は安全側に丸める） ---
    const speciesId =
      typeof parsed.speciesId === "string" && speciesIds.has(parsed.speciesId)
        ? parsed.speciesId
        : SPECIES[0].id;
    const speciesKnown =
      typeof parsed.speciesId === "string" && speciesIds.has(parsed.speciesId);

    const eyes = (
      typeof parsed.eyes === "string" && EYE_SET.has(parsed.eyes) ? parsed.eyes : "round"
    ) as EyeStyle;
    const mouth = (
      typeof parsed.mouth === "string" && MOUTH_SET.has(parsed.mouth) ? parsed.mouth : "smile"
    ) as MouthStyle;
    const accessory = (
      typeof parsed.accessory === "string" && ACC_SET.has(parsed.accessory)
        ? parsed.accessory
        : "none"
    ) as Accessory;

    let hue = Number(parsed.hue);
    if (!Number.isFinite(hue)) hue = 210;
    hue = ((Math.round(hue) % 360) + 360) % 360;

    const object = String(parsed.object ?? "").slice(0, 24) || "なにか";
    const name = String(parsed.name ?? "").slice(0, 16) || object;
    const personality = String(parsed.personality ?? "").slice(0, 16) || "マイペース";
    const description = String(parsed.description ?? "").slice(0, 80) || `${object}に宿る精霊。`;
    const confident = parsed.confident === true && speciesKnown;

    return {
      object,
      speciesId,
      confident,
      hue,
      eyes,
      mouth,
      accessory,
      name,
      personality,
      description,
    };
  });
