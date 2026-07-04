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
