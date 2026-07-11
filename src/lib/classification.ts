/**
 * 分類パイプライン（信頼性のかなめ）。
 *
 *   AIの物体認識  →  物のカテゴリ  →  モノモンの家族（Family）→ 種族（Species）
 *
 * AIは「物のカテゴリ」を決まった語彙から1つ返します。
 * そのカテゴリから家族と種族を決めるので、
 * 「あきらかに間違った家族」を割り当てることがありません。
 * （例：ハサミが「のみもの」になる、といった取り違えを防ぐ）
 */

import { SPECIES_MAP, type Species } from "./species";
import type { Family } from "./monomon-data";

/** AIに選ばせる、物のカテゴリの語彙（増やすときはここに追加）。 */
export const OBJECT_CATEGORIES = [
  // のみもの
  "cup",
  "mug",
  "bottle",
  // だいどころ
  "pot",
  "pan",
  "kettle",
  "spoon",
  "cutlery",
  // ぶんぐ
  "book",
  "notebook",
  "pencil",
  "pen",
  "scissors",
  "eraser",
  // みどり
  "plant",
  "flower",
  "cactus",
  // みのまわり・家具・くつ
  "shoe",
  "cushion",
  "chair",
  "desk",
  "bed",
  "furniture",
  // でんき
  "clock",
  "lamp",
  "light",
  "fan",
  "remote",
  "battery",
  "device",
  // かみ
  "tissue",
  "paper",
  // たべもの
  "onigiri",
  "pudding",
  "mushroom",
  "food",
] as const;

export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number];

/** カテゴリ → 姿に使う代表的な種族ID（形が最も近いもの）。 */
const CATEGORY_TO_SPECIES: Record<ObjectCategory, string> = {
  cup: "cup",
  mug: "mug",
  bottle: "bottle",

  pot: "pot",
  pan: "pot",
  kettle: "kettle",
  spoon: "spoon",
  cutlery: "spoon",

  book: "book",
  notebook: "book",
  pencil: "pencil",
  pen: "pencil",
  scissors: "scissors",
  eraser: "eraser",

  plant: "plant",
  flower: "flower",
  cactus: "cactus",

  shoe: "shoe",
  cushion: "cushion",
  chair: "cushion",
  desk: "cushion",
  bed: "cushion",
  furniture: "cushion",

  clock: "clock",
  lamp: "lamp",
  light: "lamp",
  fan: "lamp",
  remote: "battery",
  battery: "battery",
  device: "lamp",

  tissue: "tissue",
  paper: "tissue",

  onigiri: "onigiri",
  pudding: "pudding",
  mushroom: "mushroom",
  food: "onigiri",
};

const CATEGORY_SET = new Set<string>(OBJECT_CATEGORIES);

/** 与えられた文字列が既知のカテゴリか。 */
export function isKnownCategory(category: string): category is ObjectCategory {
  return CATEGORY_SET.has(category);
}

/** カテゴリから家族（Family）を求めます（未知なら null）。 */
export function familyForCategory(category: string): Family | null {
  if (!isKnownCategory(category)) return null;
  return SPECIES_MAP[CATEGORY_TO_SPECIES[category]]?.family ?? null;
}

/**
 * 最終的な種族を決めます。
 * AIが選んだ姿(speciesId)は、カテゴリの家族と一致するときだけ尊重し、
 * ずれている（家族が違う）ときはカテゴリの代表種族に丸めます。
 * こうして「明らかに違う家族」の割り当てを防ぎます。
 */
export function resolveSpecies(category: string, aiSpeciesId: string): Species {
  const aiSpecies = SPECIES_MAP[aiSpeciesId];

  // カテゴリが未知：AIの姿が有効ならそれを使う（最後の保険）
  if (!isKnownCategory(category)) {
    return aiSpecies ?? SPECIES_MAP.cup;
  }

  const canonical = SPECIES_MAP[CATEGORY_TO_SPECIES[category]];
  // AIの姿がカテゴリの家族と同じなら、その細かなシルエットを尊重
  if (aiSpecies && aiSpecies.family === canonical.family) return aiSpecies;
  // ずれていたらカテゴリの代表種族に丸める
  return canonical;
}
