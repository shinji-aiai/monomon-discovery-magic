/**
 * レア度（Rarity）。
 *
 * モノモンの「集めたくなる」感を支える指標です。種族IDから決定的に決まるので、
 * 同じ種族はいつでも同じレア度になります（ランダムではありません）。
 */

export type Rarity = 1 | 2 | 3 | 4 | 5;

export const RARITY_LABELS: Record<Rarity, string> = {
  1: "ノーマル",
  2: "レア",
  3: "スーパーレア",
  4: "エピック",
  5: "レジェンド",
};

/** 種族ごとのレア度（身近さ＝低レア、珍しさ＝高レア）。 */
const RARITY_MAP: Record<string, Rarity> = {
  cup: 1,
  mug: 1,
  bottle: 2,
  pot: 2,
  kettle: 3,
  spoon: 1,
  book: 2,
  pencil: 1,
  scissors: 2,
  eraser: 1,
  plant: 3,
  flower: 3,
  cactus: 4,
  shoe: 2,
  cushion: 2,
  clock: 3,
  lamp: 3,
  battery: 2,
  tissue: 1,
  onigiri: 3,
  pudding: 4,
  mushroom: 5,
};

/** 種族IDからレア度（★1〜★5）を返します。未知の種族は★3。 */
export function getRarity(speciesId: string): Rarity {
  return RARITY_MAP[speciesId] ?? 3;
}

export function getRarityLabel(speciesId: string): string {
  return RARITY_LABELS[getRarity(speciesId)];
}
