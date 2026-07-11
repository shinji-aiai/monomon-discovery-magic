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
  "glass",
  "tumbler",
  "can",
  "thermos",
  "flask",
  // だいどころ
  "pot",
  "pan",
  "kettle",
  "spoon",
  "cutlery",
  "bowl",
  "plate",
  "dish",
  "fork",
  "knife",
  "chopsticks",
  "ladle",
  // ぶんぐ
  "book",
  "notebook",
  "magazine",
  "pencil",
  "pen",
  "marker",
  "crayon",
  "scissors",
  "eraser",
  "ruler",
  "stapler",
  // みどり
  "plant",
  "flower",
  "cactus",
  "tree",
  "leaf",
  "bonsai",
  "succulent",
  // みのまわり・家具・くつ
  "shoe",
  "sandal",
  "slipper",
  "boot",
  "sock",
  "hat",
  "cap",
  "glove",
  "bag",
  "backpack",
  "towel",
  "blanket",
  "pillow",
  "cushion",
  "chair",
  "desk",
  "bed",
  "furniture",
  "umbrella",
  "glasses",
  // でんき・家電
  "clock",
  "watch",
  "lamp",
  "light",
  "fan",
  "circulator",
  "heater",
  "humidifier",
  "remote",
  "battery",
  "phone",
  "smartphone",
  "laptop",
  "computer",
  "tv",
  "television",
  "monitor",
  "speaker",
  "headphone",
  "camera",
  "charger",
  "appliance",
  "device",
  // かみ
  "tissue",
  "paper",
  "napkin",
  "envelope",
  "box",
  "cardboard",
  "carton",
  // たべもの
  "onigiri",
  "pudding",
  "mushroom",
  "bread",
  "rice",
  "cake",
  "cookie",
  "snack",
  "candy",
  "fruit",
  "apple",
  "banana",
  "egg",
  "food",
] as const;

export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number];

/** カテゴリ → 姿に使う代表的な種族ID（形が最も近いもの。家族は必ず正しいもの）。 */
const CATEGORY_TO_SPECIES: Record<ObjectCategory, string> = {
  // のみもの → drink
  cup: "cup",
  mug: "mug",
  bottle: "bottle",
  glass: "cup",
  tumbler: "cup",
  can: "bottle",
  thermos: "bottle",
  flask: "bottle",

  // だいどころ → kitchen
  pot: "pot",
  pan: "pot",
  kettle: "kettle",
  spoon: "spoon",
  cutlery: "spoon",
  bowl: "pot",
  plate: "pot",
  dish: "pot",
  fork: "spoon",
  knife: "spoon",
  chopsticks: "spoon",
  ladle: "spoon",

  // ぶんぐ → stationery
  book: "book",
  notebook: "book",
  magazine: "book",
  pencil: "pencil",
  pen: "pencil",
  marker: "pencil",
  crayon: "pencil",
  scissors: "scissors",
  eraser: "eraser",
  ruler: "pencil",
  stapler: "scissors",

  // みどり → plant
  plant: "plant",
  flower: "flower",
  cactus: "cactus",
  tree: "plant",
  leaf: "plant",
  bonsai: "plant",
  succulent: "cactus",

  // みのまわり → wear
  shoe: "shoe",
  sandal: "shoe",
  slipper: "shoe",
  boot: "shoe",
  sock: "shoe",
  hat: "cushion",
  cap: "cushion",
  glove: "cushion",
  bag: "cushion",
  backpack: "cushion",
  towel: "cushion",
  blanket: "cushion",
  pillow: "cushion",
  cushion: "cushion",
  chair: "cushion",
  desk: "cushion",
  bed: "cushion",
  furniture: "cushion",
  umbrella: "cushion",
  glasses: "cushion",

  // でんき・家電 → device
  clock: "clock",
  watch: "clock",
  lamp: "lamp",
  light: "lamp",
  fan: "lamp",
  circulator: "lamp",
  heater: "lamp",
  humidifier: "lamp",
  remote: "battery",
  battery: "battery",
  phone: "battery",
  smartphone: "battery",
  laptop: "lamp",
  computer: "lamp",
  tv: "lamp",
  television: "lamp",
  monitor: "lamp",
  speaker: "battery",
  headphone: "battery",
  camera: "battery",
  charger: "battery",
  appliance: "lamp",
  device: "lamp",

  // かみ → paper
  tissue: "tissue",
  paper: "tissue",
  napkin: "tissue",
  envelope: "tissue",
  box: "tissue",
  cardboard: "tissue",
  carton: "tissue",

  // たべもの → food
  onigiri: "onigiri",
  pudding: "pudding",
  mushroom: "mushroom",
  bread: "onigiri",
  rice: "onigiri",
  cake: "pudding",
  cookie: "onigiri",
  snack: "onigiri",
  candy: "pudding",
  fruit: "onigiri",
  apple: "onigiri",
  banana: "onigiri",
  egg: "onigiri",
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
