import { dexStore } from "./dex";
import type { Monomon } from "./monomon";

/**
 * 発見の「種類」。演出を切り替えるための入り口。
 * いまは new / reunion のみ。将来はここに rare / legendary /
 * seasonal / event などを足すだけで、演出を拡張できます。
 */
export type DiscoveryKind =
  | "new"
  | "reunion"
  // 将来の拡張ポイント（未使用）:
  // | "rare"
  // | "legendary"
  // | "seasonal"
  // | "event"
  ;

/** 発見のときに使う、見出しことば・雰囲気などの表示情報。 */
export interface DiscoveryPresentation {
  kind: DiscoveryKind;
  /** リビール時の見出し（新規／再会） */
  banner: string;
}

/**
 * この子が「はじめまして」か「また会えた」かを判定します。
 * まだ図鑑に登録する前（リビール中）に呼ぶ前提で、同じ種族が
 * すでに図鑑にいれば再会（reunion）とみなします。
 */
export function classifyDiscovery(monomon: Monomon): DiscoveryKind {
  const seen = dexStore
    .get()
    .some((m) => m.id !== monomon.id && m.speciesId === monomon.speciesId);
  return seen ? "reunion" : "new";
}

/** 種類ごとの見出しことば。演出追加時はここに一行足すだけ。 */
const BANNERS: Record<DiscoveryKind, string> = {
  new: "✨ あたらしいモノモンを見つけた！ ✨",
  reunion: "💛 また会えたね！",
};

/** リビールで使う表示情報をまとめて返します。 */
export function discoveryPresentation(monomon: Monomon): DiscoveryPresentation {
  const kind = classifyDiscovery(monomon);
  return { kind, banner: BANNERS[kind] };
}
