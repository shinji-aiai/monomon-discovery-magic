/**
 * モノモンのデータ定義。
 * 分類・素材・体型・表情・特徴パーツ・名前のプールをここで一元管理します。
 * 「撮ったモノの特徴」をキャラクターに反映するための語彙集です。
 */

export type Category =
  | "キッチン種"
  | "メカ種"
  | "ぬくもり種"
  | "紙もの種"
  | "食べもの種"
  | "おでかけ種"
  | "ふしぎ種"
  | "くらし種";

export const CATEGORIES: Category[] = [
  "キッチン種",
  "メカ種",
  "ぬくもり種",
  "紙もの種",
  "食べもの種",
  "おでかけ種",
  "ふしぎ種",
  "くらし種",
];

/** カード背景の質感（撮ったモノの素材感を表現） */
export type Material =
  | "ceramic"
  | "metal"
  | "cloth"
  | "paper"
  | "food"
  | "plant"
  | "glass"
  | "wood";

/** 体型（シルエットだけで区別できるように） */
export type BodyShape =
  | "round"
  | "square"
  | "tall"
  | "wide"
  | "fluffy"
  | "bean"
  | "stout";

export const BODY_SHAPES: BodyShape[] = [
  "round",
  "square",
  "tall",
  "wide",
  "fluffy",
  "bean",
  "stout",
];

/** 表情（性格に合わせて変化） */
export type Expression =
  | "smile"
  | "sleepy"
  | "shy"
  | "gentle"
  | "mischief"
  | "serious"
  | "energetic"
  | "surprised";

/** 特徴パーツ：モノの一部がキャラの一部に変わる */
export type HairType =
  | "steam"
  | "leaf"
  | "tissue"
  | "sprout"
  | "tuft"
  | "hands"
  | "none";
export type EarType = "handle" | "round" | "leaf" | "none";
export type TailType = "hose" | "flower" | "curl" | "none";
export type BellyType = "clock" | "pocket" | "button" | "none";

export interface CategoryStyle {
  /** ボディのグラデーション 2色 */
  body: [string, string];
  /** ほっぺ・差し色 */
  cheek: string;
  /** カードの背景グラデ（後方互換用） */
  bg: [string, string];
  emoji: string;
  /** この分類が宿りやすい素材 */
  material: Material;
}

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  キッチン種: { body: ["#FFD08A", "#FF9F57"], cheek: "#FF7A6B", bg: ["#FFF3E0", "#FFE0C2"], emoji: "🍳", material: "ceramic" },
  メカ種: { body: ["#A8D8F0", "#6FB6E8"], cheek: "#FF9DB0", bg: ["#E6F3FB", "#D2E8F7"], emoji: "🔩", material: "metal" },
  ぬくもり種: { body: ["#FFC9D6", "#FF9FBE"], cheek: "#FF7C9C", bg: ["#FFF0F4", "#FFDCE6"], emoji: "🧸", material: "cloth" },
  紙もの種: { body: ["#F5E6C8", "#E8CFA0"], cheek: "#E89C7C", bg: ["#FAF4E6", "#F0E4CC"], emoji: "📄", material: "paper" },
  食べもの種: { body: ["#FFC59A", "#FF9E7A"], cheek: "#FF6F61", bg: ["#FFF0E6", "#FFDCC8"], emoji: "🍡", material: "food" },
  おでかけ種: { body: ["#A8E6C9", "#62C99A"], cheek: "#FF9D7A", bg: ["#E8F8EE", "#D2F0DE"], emoji: "🌿", material: "plant" },
  ふしぎ種: { body: ["#D6C2F0", "#B49CE8"], cheek: "#FF9DD6", bg: ["#F2ECFB", "#E6DCF7"], emoji: "✨", material: "glass" },
  くらし種: { body: ["#FFE6A8", "#FFD062"], cheek: "#FF9D8A", bg: ["#FFF8E6", "#FFEFC2"], emoji: "🏠", material: "wood" },
};

/** 素材ごとのカード背景（Apple Walletのような上質な質感） */
export interface MaterialStyle {
  label: string;
  /** 背景グラデ */
  bg: [string, string];
  /** うっすら重ねる色味（写真の上のティント） */
  tint: string;
  emoji: string;
}

export const MATERIAL_STYLES: Record<Material, MaterialStyle> = {
  ceramic: { label: "うつわ", bg: ["#FBF6EF", "#EBDDC9"], tint: "#FF9F57", emoji: "🍶" },
  metal: { label: "メタル", bg: ["#EEF3F8", "#CDD9E5"], tint: "#6FB6E8", emoji: "⚙️" },
  cloth: { label: "ぬの", bg: ["#FBEFF3", "#EAD6DF"], tint: "#FF9FBE", emoji: "🧶" },
  paper: { label: "かみ", bg: ["#FBF6EA", "#EEE2C8"], tint: "#E8CFA0", emoji: "📜" },
  food: { label: "たべもの", bg: ["#FFF2E6", "#FBD9C2"], tint: "#FF9E7A", emoji: "🍯" },
  plant: { label: "みどり", bg: ["#EEF8EE", "#D3EBD6"], tint: "#62C99A", emoji: "🌱" },
  glass: { label: "ガラス", bg: ["#EBF5FA", "#D2E8F2"], tint: "#B49CE8", emoji: "💎" },
  wood: { label: "もくめ", bg: ["#F5E7D4", "#E1C7A6"], tint: "#C99A62", emoji: "🪵" },
};

/** 分類ごとの「宿りやすい特徴」プール */
interface FeaturePool {
  shapes: BodyShape[];
  hair: HairType[];
  ears: EarType[];
  tail: TailType[];
  belly: BellyType[];
}

export const FEATURE_POOLS: Record<Category, FeaturePool> = {
  キッチン種: {
    shapes: ["round", "stout", "wide", "square"],
    hair: ["steam", "steam", "tuft", "none"],
    ears: ["handle", "handle", "round"],
    tail: ["none", "curl"],
    belly: ["none", "button"],
  },
  メカ種: {
    shapes: ["square", "tall", "stout", "round"],
    hair: ["tuft", "none", "sprout"],
    ears: ["round", "none"],
    tail: ["hose", "hose", "curl"],
    belly: ["button", "clock", "none"],
  },
  ぬくもり種: {
    shapes: ["fluffy", "round", "stout", "bean"],
    hair: ["tuft", "tuft", "none"],
    ears: ["round", "round"],
    tail: ["curl", "none"],
    belly: ["pocket", "button", "none"],
  },
  紙もの種: {
    shapes: ["square", "tall", "wide"],
    hair: ["tissue", "tissue", "tuft"],
    ears: ["none", "round"],
    tail: ["none"],
    belly: ["pocket", "none"],
  },
  食べもの種: {
    shapes: ["round", "bean", "stout", "fluffy"],
    hair: ["sprout", "steam", "tuft", "none"],
    ears: ["none", "round"],
    tail: ["none", "curl"],
    belly: ["none"],
  },
  おでかけ種: {
    shapes: ["tall", "bean", "round"],
    hair: ["leaf", "leaf", "sprout"],
    ears: ["leaf", "leaf", "round"],
    tail: ["flower", "flower", "curl"],
    belly: ["none"],
  },
  ふしぎ種: {
    shapes: ["fluffy", "bean", "round", "tall"],
    hair: ["sprout", "steam", "none"],
    ears: ["none", "round"],
    tail: ["curl", "curl", "none"],
    belly: ["none", "button"],
  },
  くらし種: {
    shapes: ["round", "square", "stout", "wide"],
    hair: ["hands", "tuft", "none"],
    ears: ["round", "none"],
    tail: ["none", "curl"],
    belly: ["clock", "clock", "pocket"],
  },
};

/** 分類ごとの名前プール（短く・親しみやすく・呼びやすい） */
export const NAME_POOLS: Record<Category, string[]> = {
  キッチン種: ["コトル", "ナベリン", "ポトフィ", "オタモ", "フライン", "ボウラ", "ザルピ", "コンロン"],
  メカ種: ["ネジラ", "リモロン", "コードン", "プラギー", "デンチュ", "スイッチィ", "モタロウ", "ファンプ"],
  ぬくもり種: ["モフル", "ぬくみ", "ケットン", "ピロー", "フワリ", "クッシュ", "ぬいみ", "あたたん"],
  紙もの種: ["ティッシュン", "メモロン", "ノートン", "ペパリ", "フセン", "ダンボル", "シオリ", "コピット"],
  食べもの種: ["オニギ", "プリル", "パンナ", "ミカリン", "アメロン", "ゼリン", "ダンゴロ", "クッキン"],
  おでかけ種: ["カサモ", "クツリ", "リュック", "チャリン", "キップ", "ソトミ", "テクテ", "バスロン"],
  ふしぎ種: ["フシギン", "ナゾロ", "ホワン", "ミステ", "ゆらり", "キラポ", "モヤミ", "ふわぽ"],
  くらし種: ["ソージー", "トケロン", "コプル", "ランプー", "カギロ", "ハンガル", "スリッパ", "マドミ"],
};

/** 性格（一言）。表情と対応します。 */
export const PERSONALITIES: { label: string; expression: Expression }[] = [
  { label: "朝が弱い", expression: "sleepy" },
  { label: "人見知り", expression: "shy" },
  { label: "せっかち", expression: "energetic" },
  { label: "のんびり屋", expression: "gentle" },
  { label: "少しさみしがり", expression: "shy" },
  { label: "よく迷子になる", expression: "surprised" },
  { label: "きれい好き", expression: "serious" },
  { label: "食いしんぼう", expression: "energetic" },
  { label: "あわてんぼう", expression: "surprised" },
  { label: "がんこ者", expression: "serious" },
  { label: "おしゃべり", expression: "energetic" },
  { label: "はずかしがり", expression: "shy" },
  { label: "なまけもの", expression: "sleepy" },
  { label: "がんばりや", expression: "energetic" },
  { label: "うっかり者", expression: "surprised" },
  { label: "マイペース", expression: "gentle" },
  { label: "いたずら好き", expression: "mischief" },
  { label: "おっとり", expression: "gentle" },
];

/** 説明文（短く、クスッと笑える一文） */
export const DESCRIPTIONS: string[] = [
  "最後の1枚だけ残したがる。",
  "ソファの隙間が実家。",
  "掃除が終わると一番疲れている。",
  "晴れの日は少しさみしい。",
  "冷蔵庫の前でよく悩んでいる。",
  "朝になるまで本気を出さない。",
  "気づくと裏返しになっている。",
  "ポケットの中が落ち着くらしい。",
  "週末はだいたい行方不明。",
  "充電が切れると静かになる。",
  "押し入れの奥で瞑想している。",
  "夜中にこっそり伸びをする。",
  "なぜか机の角が好き。",
  "二度寝の天才。",
  "出かける直前に見つかる。",
  "湯気を見ると元気が出る。",
  "雨の音を聞くと眠くなる。",
  "新品のにおいが大好物。",
  "整列していると安心する。",
  "ときどき自分の名前を忘れる。",
];

/** モノモンの見た目を決める仕様（描画のための完全な指示書） */
export interface MonomonSpec {
  seed: number;
  category: Category;
  shape: BodyShape;
  expression: Expression;
  hair: HairType;
  ears: EarType;
  tail: TailType;
  belly: BellyType;
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

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

/**
 * seed と分類から、体型・特徴・表情を「決定的」に組み立てます。
 * 体型ヒント（撮った写真の縦横比など）があれば優先します。
 */
export function buildSpec(
  seed: number,
  category: Category,
  opts?: { shape?: BodyShape; expression?: Expression },
): MonomonSpec {
  const rng = rngFrom(seed ^ 0x9e3779b9);
  const pool = FEATURE_POOLS[category];
  return {
    seed,
    category,
    shape: opts?.shape ?? pick(rng, pool.shapes),
    expression: opts?.expression ?? pick(rng, ["smile", "gentle", "energetic", "sleepy", "mischief"] as Expression[]),
    hair: pick(rng, pool.hair),
    ears: pick(rng, pool.ears),
    tail: pick(rng, pool.tail),
    belly: pick(rng, pool.belly),
  };
}

/** 写真の縦横比から体型を選びます。 */
export function shapeFromAspect(aspect: number, busy: number, rng: () => number): BodyShape {
  if (aspect > 1.35) return rng() > 0.5 ? "wide" : "stout";
  if (aspect < 0.72) return rng() > 0.5 ? "tall" : "bean";
  if (busy > 0.5) return "fluffy";
  return pick(rng, ["round", "square", "round"]);
}
