import {
  CATEGORY_STYLES,
  DESCRIPTIONS,
  NAME_POOLS,
  PERSONALITIES,
  buildSpec,
  shapeFromAspect,
  type Category,
  type Material,
  type MonomonSpec,
} from "./monomon-data";
import { analyzePhoto, type PhotoAnalysis } from "./image-utils";

export interface Monomon extends MonomonSpec {
  id: string;
  name: string;
  personality: string;
  description: string;
  /** カード背景の素材感 */
  material: Material;
  /** ISO日時。発見日。 */
  discoveredAt: string;
  /** 元になった写真（縮小したdata URL） */
  photo: string;
  /** お気に入り */
  favorite?: boolean;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 写真の色合いから、宿る分類を選びます。 */
function categoryFromAnalysis(a: PhotoAnalysis, rng: () => number): Category {
  const { hue, saturation, lightness } = a;
  // 彩度が低い＝無機質 → 明るければ紙、暗ければメカ
  if (saturation < 0.13) {
    if (lightness > 0.7) return rng() > 0.5 ? "紙もの種" : "くらし種";
    return rng() > 0.4 ? "メカ種" : "ふしぎ種";
  }
  if (hue < 22 || hue >= 345) return rng() > 0.5 ? "食べもの種" : "ぬくもり種";
  if (hue < 45) return rng() > 0.45 ? "キッチン種" : "食べもの種";
  if (hue < 70) return rng() > 0.5 ? "くらし種" : "キッチン種";
  if (hue < 165) return "おでかけ種";
  if (hue < 255) return "メカ種";
  if (hue < 310) return "ふしぎ種";
  return "ぬくもり種";
}

/**
 * 写真から「モノモン」を生成します。
 *
 * 写真の色・形・賑やかさを分析し、宿る分類・体型・特徴・表情を
 * 「撮ったモノ」に合わせて決めます。同じ写真でも発見の瞬間ごとに
 * 少しだけ表情や個性が変わります。
 *
 * ⚠️ キャラクターの描画はプロシージャル（手続き的）なモック実装です。
 *    将来 AI 画像生成APIに接続する場合は、この関数の中身だけを
 *    差し替えてください。呼び出し側・表示側は変更不要です。
 */
export async function generateMonomon(photo: string): Promise<Monomon> {
  const analysis = await analyzePhoto(photo);

  const base = hashString(photo.slice(0, 2048));
  const seed = (base ^ Math.floor(Date.now() / 1000)) >>> 0;
  const rng = rngFrom(seed);

  const category = categoryFromAnalysis(analysis, rng);
  const names = NAME_POOLS[category];
  const name = names[Math.floor(rng() * names.length)];
  const persona = PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)];
  const description = DESCRIPTIONS[Math.floor(rng() * DESCRIPTIONS.length)];
  const material = CATEGORY_STYLES[category].material;

  const shape = shapeFromAspect(analysis.aspect, analysis.busy, rng);
  const spec = buildSpec(seed, category, {
    shape,
    expression: persona.expression,
  });

  return {
    ...spec,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mm_${seed}_${Date.now()}`,
    name,
    personality: persona.label,
    description,
    material,
    discoveredAt: new Date().toISOString(),
    photo,
    favorite: false,
  };
}

/** 保存済みデータや簡易表示から、確実に描画用 spec を取り出します。 */
export function specOf(m: Partial<Monomon> & { seed: number; category: Category }): MonomonSpec {
  if (m.shape && m.expression && m.hair && m.ears && m.tail && m.belly) {
    return {
      seed: m.seed,
      category: m.category,
      shape: m.shape,
      expression: m.expression,
      hair: m.hair,
      ears: m.ears,
      tail: m.tail,
      belly: m.belly,
    };
  }
  return buildSpec(m.seed, m.category);
}

export function formatDiscoveredDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return "";
  }
}
