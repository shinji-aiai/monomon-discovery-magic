import type { CSSProperties } from "react";
import type { Monomon } from "./monomon";

/**
 * 撮ったモノの「色の雰囲気」を演出へ渡すための小さな道具です。
 *
 * キャラクター本体（公式デザイン）は一切変えません。
 * 周囲のオーラ・背景の淡い光・足元のグローなど、空気の色だけをそっと寄せます。
 * 反映はひかえめ（およそ 10〜30%）で、Monomon の世界観を壊しません。
 */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const FALLBACK: Hsl = { h: 40, s: 45, l: 65 };

function parseHsl(color: string | undefined): Hsl {
  if (!color) return FALLBACK;
  const m = color.match(
    /hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i,
  );
  if (!m) return FALLBACK;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * 撮ったモノの主色から、演出用のCSS変数を作ります。
 * 黒い水筒なら暗い灰、青いコップなら青、植物なら緑の空気になります。
 */
export function auraVars(monomon?: Monomon | null): CSSProperties {
  const base = parseHsl(monomon?.palette?.c2);
  const h = ((base.h % 360) + 360) % 360;

  // 光としてにじませるので、暗すぎ・鮮やかすぎは少しだけ整える
  const s = clamp(base.s, 6, 62);
  const l = clamp(base.l, 26, 78);

  // 足元の影は、主色を落ち着かせた暗い色
  const shadowS = clamp(base.s * 0.6, 4, 40);
  const shadowL = clamp(base.l - 34, 10, 40);

  return {
    "--aura": `hsl(${h}, ${s}%, ${l}%)`,
    "--aura-strong": `hsla(${h}, ${s}%, ${l}%, 0.34)`,
    "--aura-mid": `hsla(${h}, ${s}%, ${l}%, 0.22)`,
    "--aura-soft": `hsla(${h}, ${s}%, ${l}%, 0.12)`,
    "--aura-shadow": `hsla(${h}, ${shadowS}%, ${shadowL}%, 0.3)`,
  } as CSSProperties;
}
