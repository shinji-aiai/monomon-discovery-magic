import {
  COMMENTS,
  PERSONALITIES,
  EYE_POOL,
  MOUTH_POOL,
  PATTERN_POOL,
  POSE_POOL,
  genName,
  genPalette,
  mulberry32,
  pick,
  type Family,
  type MonomonSpec,
} from "./monomon-data";
import { SPECIES_MAP, detectSpecies, getSpecies } from "./species";
import { analyzePhoto } from "./image-utils";
import { analyzeSpirit } from "./monomon-ai.functions";

export interface Monomon extends MonomonSpec {
  id: string;
  name: string;
  /** 種族の所属（カード背景の質感づけに使用） */
  family: Family;
  personality: string;
  /** 一言コメント */
  description: string;
  /** ISO日時。発見日。 */
  discoveredAt: string;
  /** 元になった写真（縮小したdata URL） */
  photo: string;
  /** お気に入り */
  favorite?: boolean;
  /** AIが認識した物体名（例：コップ、ハサミ、傘） */
  objectLabel?: string;
  /** AIの認識に自信が低い＝推定表示（「○○の仲間かもしれない」） */
  uncertain?: boolean;
}

function makeId(seed: number): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mm_${seed}_${Date.now()}`;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * spec（種族 + 個体の見た目）を seed から決定的に組み立てます。
 * hueBias があれば個体の色相の中心に使います（写真の色などを反映）。
 */
export function buildSpec(
  seed: number,
  speciesId: string,
  hueBias?: number,
): MonomonSpec {
  const rng = mulberry32(seed ^ 0x85ebca6b);
  const species = getSpecies(speciesId);
  // 色相：写真の色を尊重しつつ、種族の寄せ先があれば少し混ぜる
  let hue = hueBias ?? rng() * 360;
  if (species.hueHint != null) hue = (hue + species.hueHint * 2) / 3;
  hue = (hue + (rng() - 0.5) * 30 + 360) % 360;

  return {
    speciesId,
    seed,
    palette: genPalette(rng, hue),
    eyes: pick(rng, EYE_POOL),
    mouth: pick(rng, MOUTH_POOL),
    pattern: pick(rng, PATTERN_POOL),
    accessory: pick(rng, ACCESSORY_POOL),
    pose: pick(rng, POSE_POOL),
  };
}

/**
 * 写真から「モノモン（個体）」を生成します。
 *
 * 写真の色・明るさ・縦横比・賑やかさを分析して宿る種族を選び、
 * さらに撮影した瞬間（時刻）を混ぜることで、同じ写真でも
 * 毎回ちがう個体（色・目・口・模様・アクセサリー・ポーズ・性格）になります。
 * 世界に同じ個体は存在しません。
 *
 * ⚠️ キャラクターの描画はプロシージャルなモック実装です。
 *    将来 AI 画像生成APIへ接続する場合は、この関数の中身だけを
 *    差し替えてください（speciesId と個体パラメータを渡せば表示はそのまま）。
 */
export async function generateMonomon(photo: string): Promise<Monomon> {
  const analysis = await analyzePhoto(photo);

  // 写真の指紋＋撮影の瞬間（時刻・分単位）で、毎回ゆらぐ seed を作る
  const base = hashString(photo.slice(0, 2048));
  const moment = Math.floor(Date.now() / 1000);
  const seed = (base ^ Math.imul(moment, 2654435761)) >>> 0;
  const rng = mulberry32(seed);

  const species = detectSpecies(analysis, rng);
  const spec = buildSpec(seed, species.id, analysis.hue);

  const nameRng = mulberry32(seed ^ 0xc2b2ae35);
  const name = genName(nameRng);
  const personality = pick(nameRng, PERSONALITIES);
  const description = pick(nameRng, COMMENTS);

  return {
    ...spec,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mm_${seed}_${Date.now()}`,
    name,
    family: species.family,
    personality,
    description,
    discoveredAt: new Date().toISOString(),
    photo,
    favorite: false,
  };
}

/** 装飾用：seed だけから、それっぽい個体 spec を作ります。 */
export function specFromSeed(seed: number, speciesId?: string): MonomonSpec {
  const id =
    speciesId ??
    Object.keys(SPECIES_MAP)[seed % Object.keys(SPECIES_MAP).length];
  return buildSpec(seed >>> 0, id);
}

/** 保存済み/簡易データから、確実に描画用 spec を取り出します（後方互換あり）。 */
export function specOf(
  m: Partial<MonomonSpec> & { seed: number; speciesId?: string },
): MonomonSpec {
  if (m.speciesId && m.palette && m.eyes && m.mouth && m.pattern && m.accessory && m.pose) {
    return {
      speciesId: m.speciesId,
      seed: m.seed,
      palette: m.palette,
      eyes: m.eyes,
      mouth: m.mouth,
      pattern: m.pattern,
      accessory: m.accessory,
      pose: m.pose,
    };
  }
  // 旧バージョンのデータ → 種族を仮決めして再構築
  return buildSpec(m.seed >>> 0, m.speciesId ?? "cup");
}

export function formatDiscoveredDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return "";
  }
}
