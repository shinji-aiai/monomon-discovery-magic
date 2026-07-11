import type { Monomon } from "./monomon";

/**
 * なかよし度（Friendship）ドメイン。
 *
 * ここは「なかよし度」に関するルールの単一の置き場所です。
 * レベルの境界・表情・セリフ・増加量をまとめており、
 * 将来の機能（お願い・プレゼント・進化・実績）は
 * このレベル定義や増加アクションを起点に拡張できます。
 *
 * データの永続化（保存）は dex.ts が担当し、
 * このファイルは「純粋な計算」だけを持ちます（テストしやすく壊れにくい）。
 */

export const MIN_FRIENDSHIP = 0;
export const MAX_FRIENDSHIP = 100;

/** なかよし度が増える行動と増加量（将来の拡張の起点） */
export const FRIENDSHIP_GAINS = {
  /** モノモンをタップ（なでる） */
  pet: 1,
  /** 今日はじめて会う */
  dailyMeet: 5,
  /** 同じモノを再度発見 */
  rediscover: 3,
} as const;

export type FriendshipAction = keyof typeof FRIENDSHIP_GAINS;

/** なかよし度の段階（表情・セリフつき）。将来は進化条件などにも使えます。 */
export interface FriendshipLevel {
  id: string;
  /** この段階の下限（含む） */
  min: number;
  /** この段階の上限（含む） */
  max: number;
  /** 表情（絵文字） */
  face: string;
  /** その段階でのセリフ */
  quote: string;
  /** 段階の名前（画面表示や実績で使える） */
  label: string;
}

export const FRIENDSHIP_LEVELS: FriendshipLevel[] = [
  { id: "hello", min: 0, max: 24, face: "🙂", quote: "こんにちは！", label: "であったばかり" },
  { id: "again", min: 25, max: 49, face: "😊", quote: "また会えたね！", label: "なかよし" },
  { id: "thanks", min: 50, max: 74, face: "🥰", quote: "今日もありがとう！", label: "だいすき" },
  { id: "happy", min: 75, max: 100, face: "✨", quote: "君のおかげで幸せ！", label: "しんゆう" },
];

/** 0〜100 の範囲に丸めます。 */
export function clampFriendship(v: number): number {
  return Math.max(MIN_FRIENDSHIP, Math.min(MAX_FRIENDSHIP, Math.round(v)));
}

/** そのモノモンの現在のなかよし度（未設定は 0）。 */
export function getFriendship(m: Pick<Monomon, "friendship">): number {
  return clampFriendship(m.friendship ?? 0);
}

/** なかよし度から段階（表情・セリフ）を求めます。 */
export function getFriendshipLevel(value: number): FriendshipLevel {
  const v = clampFriendship(value);
  return (
    FRIENDSHIP_LEVELS.find((l) => v >= l.min && v <= l.max) ??
    FRIENDSHIP_LEVELS[0]
  );
}

/** ISO日時が「今日（端末ローカル）」かどうか。 */
export function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** 行動によってなかよし度を加算した新しいモノモンを返します（純粋関数）。 */
export function withFriendshipGain(m: Monomon, action: FriendshipAction): Monomon {
  return {
    ...m,
    friendship: clampFriendship(getFriendship(m) + FRIENDSHIP_GAINS[action]),
  };
}

/**
 * 「会いに来た」ときの処理。
 * 今日はじめてなら dailyMeet を加算し、最終来訪日を更新します。
 */
export function withMeet(m: Monomon): { monomon: Monomon; gained: boolean } {
  if (isToday(m.lastMetAt)) return { monomon: m, gained: false };
  return {
    monomon: {
      ...withFriendshipGain(m, "dailyMeet"),
      lastMetAt: new Date().toISOString(),
    },
    gained: true,
  };
}

/* =========================================================================
 * 再会（Reunion）— フェーズ1
 *
 * 会いに来た（詳細を開いた／発見した）ときの「再会」を扱います。
 * ・初回発見日（discoveredAt）・最終来訪日（lastMetAt）・再会回数（reunionCount）
 *   ・なかよし度（friendship）を土台に、
 *   再会回数や経過日数・なかよし度に応じてセリフを出し分けます。
 * ======================================================================= */

/** なかよし度が節目に達すると新しいセリフが解放される（フェーズ1のしきい値）。 */
export const FRIENDSHIP_UNLOCKS = [20, 50, 100] as const;

/** 前回会ってからのおおよその経過日数（未記録なら Infinity）。 */
export function daysSince(iso?: string): number {
  if (!iso) return Infinity;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/** 再会の結果（UI でセリフやお祝い演出に使う）。 */
export interface ReunionResult {
  monomon: Monomon;
  /** 今日はじめての来訪だったか（＝再会が成立したか） */
  isReunion: boolean;
  /** これまでの再会回数（今回を含む） */
  reunionCount: number;
  /** 前回会ってからのおおよその経過日数 */
  daysSinceLastMet: number;
  /** なかよし度が増えた量（0 なら増えていない） */
  friendshipGained: number;
  /** 今回の再会で新しく解放されたなかよし度のしきい値（20/50/100）。なければ undefined */
  unlockedThreshold?: number;
}

/**
 * 「会いに来た」ときの再会処理（純粋関数）。
 * 今日はじめてなら dailyMeet を加算し、再会回数を +1、最終来訪日を更新します。
 * 既存の遊び（+5/日）はそのままに、再会の記録だけを重ねます。
 */
export function reunion(m: Monomon): ReunionResult {
  const daysSinceLastMet = daysSince(m.lastMetAt);
  const prevCount = m.reunionCount ?? 0;

  // 今日すでに会っていれば、記録は変えずに現状を返す
  if (isToday(m.lastMetAt)) {
    return {
      monomon: m,
      isReunion: false,
      reunionCount: prevCount,
      daysSinceLastMet,
      friendshipGained: 0,
    };
  }

  const before = getFriendship(m);
  const gainedMon = withFriendshipGain(m, "dailyMeet");
  const after = getFriendship(gainedMon);

  // 20/50/100 をまたいだら、その節目を解放とみなす
  const unlockedThreshold = FRIENDSHIP_UNLOCKS.find(
    (t) => before < t && after >= t,
  );

  return {
    monomon: {
      ...gainedMon,
      reunionCount: prevCount + 1,
      lastMetAt: new Date().toISOString(),
    },
    isReunion: true,
    reunionCount: prevCount + 1,
    daysSinceLastMet,
    friendshipGained: after - before,
    unlockedThreshold,
  };
}

/** 長く会えていなかったときのセリフ。 */
const LONG_ABSENCE_QUOTES = ["久しぶり！元気だった？", "ずっと待ってたよ！"];

/**
 * 再会したときのセリフを、経過日数・なかよし度・再会回数から選びます。
 * ・長く会えていなかったとき → 久しぶりのセリフ
 * ・なかよし度の節目（20/50/100）で特別なセリフを解放
 * ・それ以外は再会回数の節目（1/3/10 回）で出し分け
 */
export function getReunionDialogue(opts: {
  reunionCount: number;
  daysSinceLastMet: number;
  friendship: number;
}): string {
  const { reunionCount, daysSinceLastMet, friendship } = opts;

  if (daysSinceLastMet >= 7) {
    return daysSinceLastMet >= 30
      ? LONG_ABSENCE_QUOTES[1]
      : LONG_ABSENCE_QUOTES[0];
  }

  // なかよし度で解放される特別なセリフ
  if (friendship >= 100) return "きみといると世界が輝くよ！";
  if (friendship >= 50) return "きみは特別な友だちだね！";
  if (friendship >= 20) return "また会えてすごくうれしい！";

  // 再会回数の節目
  if (reunionCount >= 10) return "もう親友だね！";
  if (reunionCount >= 3) return "最近よく会えてうれしい！";
  return "あっ！また会えたね！";
}
