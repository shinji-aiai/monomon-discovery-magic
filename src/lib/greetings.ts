import type { Monomon } from "./monomon";

/**
 * 出会えたモノモンが、その物の気持ちとして話す短い一言。
 * 句読点（。、）は使わず、絵本のようにやさしく・短く。
 * 一部は認識した物の名前（objectLabel）を差し込んで、その子らしさを出す。
 */

const GENERIC_GREETINGS = [
  "いつも使ってくれてありがとう😊",
  "今日は会えて嬉しい！",
  "また見つけてね！",
  "そばにいられて嬉しいな✨",
  "見つけてくれてありがとう💫",
  "ずっと待ってたよ🌸",
  "きみに会えるって信じてた！",
  "これからもよろしくね😌",
  "大切にしてくれて嬉しい💛",
  "また遊びに来てね！",
];

const OBJECT_GREETINGS = [
  (o: string) => `ぼくは${o}族！`,
  (o: string) => `${o}の中で待ってたよ✨`,
  (o: string) => `${o}っていいでしょ？😊`,
  (o: string) => `${o}にはぼくが宿ってるんだ💫`,
];

function seededPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * その子のための一言をランダムに選びます。
 * 同じ子なら毎回同じ言葉になるよう id をもとにゆらぎを作ります。
 */
export function greetingFor(m: Monomon): string {
  const seed =
    (m.id.charCodeAt(0) || 0) +
    (m.id.charCodeAt(m.id.length - 1) || 0) +
    Math.floor(Date.now() / 1000);
  const label = m.objectLabel?.trim();
  // 物の名前があれば、約4割で「その物らしい一言」を選ぶ
  if (label && seed % 5 < 2) {
    return seededPick(OBJECT_GREETINGS, seed)(label);
  }
  return seededPick(GENERIC_GREETINGS, seed);
}
