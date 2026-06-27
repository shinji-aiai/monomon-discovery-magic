/**
 * モノモンの「種族」と「個体」を支えるデータ定義。
 *
 * ■ 種族（Species）… コップ族・ナベ族など。固定。デザインルールを持つ（species.ts）。
 * ■ 個体（Individual）… 同じ種族でも、色・目・口・模様・アクセサリー・ポーズ・性格・
 *   一言コメントの組み合わせで毎回ちがう。世界に同じ個体は存在しない。
 *
 * このファイルは「個体のバリエーション語彙」と「大分類（Family）の見た目」を持ちます。
 */

/* =========================================================================
 * 大分類（Family）— カード背景の質感づけ・種族のグルーピングに使用
 * ======================================================================= */

export type Family =
  | "drink"
  | "kitchen"
  | "stationery"
  | "plant"
  | "wear"
  | "device"
  | "paper"
  | "food";

export interface FamilyStyle {
  label: string;
  emoji: string;
  /** カード背景グラデ */
  bg: [string, string];
  /** 写真の上にうっすら重ねる色味 */
  tint: string;
}

export const FAMILY_STYLES: Record<Family, FamilyStyle> = {
  drink: { label: "のみもの", emoji: "🥤", bg: ["#ECF6FB", "#D3E9F4"], tint: "#7FC4E8" },
  kitchen: { label: "だいどころ", emoji: "🍳", bg: ["#FBF6EF", "#EBDDC9"], tint: "#FF9F57" },
  stationery: { label: "ぶんぐ", emoji: "✏️", bg: ["#FBF6EA", "#EEE2C8"], tint: "#E8B45C" },
  plant: { label: "みどり", emoji: "🌿", bg: ["#EEF8EE", "#D3EBD6"], tint: "#62C99A" },
  wear: { label: "みのまわり", emoji: "👟", bg: ["#FBEFF3", "#EAD6DF"], tint: "#FF9FBE" },
  device: { label: "でんき", emoji: "💡", bg: ["#EFF3F8", "#D2DDE9"], tint: "#7FA8E8" },
  paper: { label: "かみ", emoji: "📄", bg: ["#FBF7EE", "#EEE4D0"], tint: "#E8CFA0" },
  food: { label: "たべもの", emoji: "🍙", bg: ["#FFF3E8", "#FBDCC6"], tint: "#FF9E7A" },
};

/* =========================================================================
 * 乱数ユーティリティ（seed から決定的に生成）
 * ======================================================================= */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

/* =========================================================================
 * 配色（Palette）— 個体ごとに無限の色。ただし必ずパステルで「ぬいぐるみ感」。
 * ======================================================================= */

export interface Palette {
  c1: string; // ボディ上部（明るい）
  c2: string; // ボディ下部（中間）
  c3: string; // 差し色・手足・ディテール
  line: string; // 輪郭
  cheek: string; // ほっぺ
  hue: number;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/** 色相をもとに、やさしいパステル配色を作ります。 */
export function genPalette(rng: () => number, hue: number): Palette {
  const s = 58 + rng() * 18; // 彩度（落ち着いたパステル域）
  return {
    c1: hsl(hue, s, 85),
    c2: hsl(hue, s, 71),
    c3: hsl(hue, s * 0.92, 57),
    line: hsl(hue, 32, 37),
    cheek: hsl(350, 78, 80),
    hue,
  };
}

/* =========================================================================
 * 個体のバリエーション語彙
 * ======================================================================= */

export type EyeStyle =
  | "round"
  | "sparkle"
  | "dot"
  | "oval"
  | "wink"
  | "closed"
  | "sleepy"
  | "starry"
  | "cross";

export type MouthStyle =
  | "smile"
  | "open"
  | "cat"
  | "small"
  | "grin"
  | "ooh"
  | "tongue";

export type PatternKind =
  | "none"
  | "dots"
  | "stripes"
  | "spots"
  | "heart"
  | "freckle";

export type Accessory =
  | "none"
  | "leaf"
  | "bow"
  | "star"
  | "antenna"
  | "flower"
  | "crown"
  | "halo"
  | "hat";

export type Pose = "stand" | "wave" | "tilt" | "cheer" | "jump";

export const EYE_POOL: EyeStyle[] = [
  "round", "round", "sparkle", "sparkle", "dot", "oval", "wink", "closed", "sleepy", "starry", "cross",
];
export const MOUTH_POOL: MouthStyle[] = [
  "smile", "smile", "cat", "open", "small", "grin", "ooh", "tongue",
];
export const PATTERN_POOL: PatternKind[] = [
  "none", "none", "none", "dots", "stripes", "spots", "heart", "freckle",
];
export const ACCESSORY_POOL: Accessory[] = [
  "none", "none", "none", "none", "leaf", "bow", "star", "antenna", "flower", "crown", "halo", "hat",
];
export const POSE_POOL: Pose[] = ["stand", "stand", "wave", "tilt", "cheer", "jump"];

/* =========================================================================
 * 名前（個体ごとに固有・無限に生成）
 * ======================================================================= */

const NAME_HEAD = ["コ","ポ","ミ","モ","ナ","ル","フ","チ","ピ","タ","ク","シ","リ","プ","ペ","マ","ノ","ホ","ソ","ト","ニ","ラ","キ","ム","ユ","ココ","ぷ","ふわ"];
const NAME_MID = ["ロ","ル","ミ","ナ","ポ","フ","タ","ク","チ","リ","ム","プ","コ","ノ","モ","ピ","ラ"];
const NAME_TAIL = ["ン","リ","タ","ロ","ム","ナ","ポ","ち","ぽ","くん","ぴ"];

/** seed から、世界にひとつだけの呼び名を作ります。 */
export function genName(rng: () => number): string {
  const mora = rng() < 0.4 ? 2 : 3;
  let s = pick(rng, NAME_HEAD);
  for (let i = 0; i < mora - 2; i++) s += pick(rng, NAME_MID);
  s += pick(rng, NAME_TAIL);
  return s;
}

/* =========================================================================
 * 性格・一言コメント
 * ======================================================================= */

export const PERSONALITIES: string[] = [
  "朝が弱い", "人見知り", "せっかち", "のんびり屋", "さみしがり", "よく迷子になる",
  "きれい好き", "食いしんぼう", "あわてんぼう", "がんこ者", "おしゃべり", "はずかしがり",
  "なまけもの", "がんばりや", "うっかり者", "マイペース", "いたずら好き", "おっとり",
  "夢みがち", "好奇心おうせい", "あまえんぼう", "しっかり者", "天然", "negaいごと上手",
];

export const COMMENTS: string[] = [
  "最後の1個だけ残したがる。",
  "ソファの隙間が実家。",
  "そうじが終わると一番つかれている。",
  "晴れの日は少しさみしい。",
  "冷蔵庫の前でよく悩んでいる。",
  "朝になるまで本気を出さない。",
  "気づくと裏返しになっている。",
  "ポケットの中が落ち着くらしい。",
  "週末はだいたい行方不明。",
  "夜中にこっそり伸びをする。",
  "なぜか机の角が好き。",
  "二度寝の天才。",
  "出かける直前に見つかる。",
  "湯気を見ると元気が出る。",
  "雨の音を聞くとねむくなる。",
  "新品のにおいが大好物。",
  "整列していると安心する。",
  "ときどき自分の名前を忘れる。",
  "かげからこっそり見守っている。",
  "ほめられると体がぴかぴか光る。",
  "まんまるい物に話しかける。",
  "日なたで充電している。",
  "あいさつだけは誰にも負けない。",
  "丸まると世界一しあわせ。",
];

/* =========================================================================
 * 描画用スペック（個体の完全な指示書）
 * ======================================================================= */

export interface MonomonSpec {
  /** 種族ID（species.ts の SPECIES と対応） */
  speciesId: string;
  seed: number;
  palette: Palette;
  eyes: EyeStyle;
  mouth: MouthStyle;
  pattern: PatternKind;
  accessory: Accessory;
  pose: Pose;
}
