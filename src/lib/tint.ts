import type { Monomon } from "./monomon";

/**
 * 撮ったモノの主色を「キャラクター本体」へ、ほんの少しだけ重ねるための道具です。
 *
 * 公式デザイン（形・顔・目・口・立体感・質感・陰影）は一切変えません。
 * 明るさ（陰影）はそのまま残し、色みだけを 20〜30% ほど寄せます。
 * 白いノートは生成り寄り、黒いノートはチャコール寄り、青いコップは青寄りへ。
 */

export interface BodyTint {
  /** 色み（hue/彩度）を寄せる色 */
  color: string;
  /** 色みの強さ（0〜0.3） */
  colorOpacity: number;
  /** 明暗を寄せる色（暗いモノ／明るいモノのとき） */
  toneColor: string;
  /** 明暗の重ね方 */
  toneMode: "multiply" | "screen";
  /** 明暗の強さ（0〜0.34） */
  toneOpacity: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function parseHsl(color: string | undefined): Hsl | null {
  if (!color) return null;
  const m = color.match(/hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/** 個体の主色から、本体に重ねる色みを決めます。 */
export function bodyTint(monomon?: Monomon | null): BodyTint | null {
  const base = parseHsl(monomon?.palette?.c2);
  if (!base) return null;

  const h = ((base.h % 360) + 360) % 360;
  const s = base.s;
  const l = base.l;

  // 色み：やさしいパステルの範囲に収める
  const tintS = clamp(s, 12, 62);
  const tintL = clamp(l, 34, 76);
  // 彩度がほとんど無いモノ（白・黒・灰）は色みを乗せない
  const colorOpacity = s < 8 ? 0 : clamp(0.2 + (s / 100) * 0.12, 0.2, 0.3);

  let toneColor = `hsl(${h}, ${Math.round(tintS * 0.3)}%, 50%)`;
  let toneMode: "multiply" | "screen" = "multiply";
  let toneOpacity = 0;

  if (l < 42) {
    toneMode = "multiply";
    toneColor = `hsl(${h}, ${Math.round(clamp(s * 0.35, 0, 30))}%, ${Math.round(clamp(l + 18, 26, 58))}%)`;
    toneOpacity = clamp(((42 - l) / 42) * 0.5, 0, 0.34);
  } else if (l > 70) {
    toneMode = "screen";
    toneColor = `hsl(${h}, ${Math.round(clamp(s * 0.3, 0, 26))}%, ${Math.round(clamp(l, 70, 94))}%)`;
    toneOpacity = clamp(((l - 70) / 30) * 0.4, 0, 0.28);
  }

  if (colorOpacity === 0 && toneOpacity === 0) return null;
  return { color: `hsl(${h}, ${Math.round(tintS)}%, ${Math.round(tintL)}%)`, colorOpacity, toneColor, toneMode, toneOpacity };
}
