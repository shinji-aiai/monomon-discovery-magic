/**
 * モノモンの姿をSVGで手続き的に描きます。
 *
 * v2.0（デザイン刷新）：全種族を「ガラス瓶＋顔＋光沢」型の統一キャラクター
 * ブランドで描画します。種族ごとに瓶のシルエット（背丈・肩・首・キャップ・小物）を
 * わずかに変え、同じ世界の住人だと一目で分かるようにします。
 *
 * 見た目の狙い（添付リファレンス「クロボトル／サーモル」に一致）:
 *  - 半透明ガラス／樹脂の質感
 *  - 内側からほのかに発光している
 *  - 大きく丸い目、小さな口、柔らかな表情
 *  - コルクの栓と小さな赤い札（首のお守り）
 *  - 小さな手足
 *  - 暗い背景でも輪郭が美しく見える
 */

import type {
  Accessory,
  EyeStyle,
  MonomonSpec,
  MouthStyle,
  Palette,
} from "./monomon-data";
import { getSpecies } from "./species";

/* ===================== 表情 ===================== */

const EYE_DARK = "#1a1420";

function eyes(kind: EyeStyle, cx: number, cy: number, spread: number, size: number): string {
  const lx = cx - spread;
  const rx = cx + spread;

  const round = (x: number) => {
    const rw = size * 0.9;
    const rh = size * 1.08;
    return `
      <ellipse cx="${x}" cy="${cy}" rx="${rw}" ry="${rh}" fill="${EYE_DARK}"/>
      <ellipse cx="${x - rw * 0.32}" cy="${cy - rh * 0.42}" rx="${rw * 0.32}" ry="${rh * 0.3}" fill="#fff"/>
      <circle cx="${x + rw * 0.28}" cy="${cy + rh * 0.35}" r="${rw * 0.18}" fill="#fff" opacity="0.85"/>
    `;
  };
  const happy = (x: number) =>
    `<path d="M ${x - size} ${cy + 2} Q ${x} ${cy - size} ${x + size} ${cy + 2}" fill="none" stroke="${EYE_DARK}" stroke-width="3.2" stroke-linecap="round"/>`;
  const sleepy = (x: number) =>
    `<path d="M ${x - size} ${cy - 1} Q ${x} ${cy + size * 0.7} ${x + size} ${cy - 1}" fill="none" stroke="${EYE_DARK}" stroke-width="3.2" stroke-linecap="round"/>`;
  const starry = (x: number) => {
    let d = "";
    for (let i = 0; i < 5; i++) {
      const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = a1 + Math.PI / 5;
      d += `${i === 0 ? "M" : "L"} ${(x + Math.cos(a1) * size).toFixed(1)} ${(cy + Math.sin(a1) * size).toFixed(1)} L ${(x + Math.cos(a2) * size * 0.45).toFixed(1)} ${(cy + Math.sin(a2) * size * 0.45).toFixed(1)} `;
    }
    return `<path d="${d}Z" fill="${EYE_DARK}"/>`;
  };

  switch (kind) {
    case "closed":
    case "wink":
    case "sleepy":
      return kind === "wink" ? happy(lx) + round(rx) : kind === "sleepy" ? sleepy(lx) + sleepy(rx) : happy(lx) + happy(rx);
    case "starry":
      return starry(lx) + starry(rx);
    default:
      return round(lx) + round(rx);
  }
}

function mouth(kind: MouthStyle, cx: number, my: number): string {
  switch (kind) {
    case "open":
      return `<path d="M ${cx - 6} ${my - 1} Q ${cx} ${my + 8} ${cx + 6} ${my - 1} Z" fill="#5a2436"/>`;
    case "cat":
      return `<path d="M ${cx - 7} ${my} Q ${cx - 3.5} ${my + 4} ${cx} ${my} Q ${cx + 3.5} ${my + 4} ${cx + 7} ${my}" fill="none" stroke="${EYE_DARK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "small":
      return `<path d="M ${cx - 3} ${my} Q ${cx} ${my + 3} ${cx + 3} ${my}" fill="none" stroke="${EYE_DARK}" stroke-width="2.2" stroke-linecap="round"/>`;
    case "ooh":
      return `<ellipse cx="${cx}" cy="${my + 1}" rx="3" ry="4" fill="${EYE_DARK}"/>`;
    default:
      return `<path d="M ${cx - 6} ${my} Q ${cx} ${my + 6} ${cx + 6} ${my}" fill="none" stroke="${EYE_DARK}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
}

/* ===================== 瓶シルエット（種族ごと・微差） =====================
 *
 * 「同じブランドの瓶」感を最優先。種族はプロポーションで少し差をつける。
 */

interface BottleShape {
  /** 瓶の首の幅（半分） */
  neckHalf: number;
  /** 瓶の肩の位置 y */
  shoulderY: number;
  /** 瓶胴の最大幅（半分） */
  bodyHalf: number;
  /** 瓶の上端 y（コルクの下） */
  topY: number;
  /** 瓶の底 y */
  bottomY: number;
  /** 底のふくらみ・丸み */
  bottomR: number;
  /** コルクの高さ */
  corkH: number;
  /** 顔中心 y のオフセット（胴の中央からの補正） */
  faceOffset: number;
}

function shapeFor(seed: number, family: string): BottleShape {
  const base: BottleShape = {
    neckHalf: 14,
    shoulderY: 62,
    bodyHalf: 46,
    topY: 42,
    bottomY: 176,
    bottomR: 22,
    corkH: 24,
    faceOffset: 0,
  };
  const wobble = ((seed >>> 3) % 5) - 2; // -2..2
  switch (family) {
    case "drink":
      return { ...base, bodyHalf: 44 + wobble, shoulderY: 66 };
    case "kitchen":
      return { ...base, bodyHalf: 52, shoulderY: 74, bottomY: 172, bottomR: 30 };
    case "stationery":
      return { ...base, bodyHalf: 34 + wobble, shoulderY: 58, neckHalf: 12 };
    case "plant":
      return { ...base, bodyHalf: 48, shoulderY: 78, bottomR: 26 };
    case "wear":
      return { ...base, bodyHalf: 50, shoulderY: 78, bottomR: 28 };
    case "device":
      return { ...base, bodyHalf: 40, shoulderY: 60, neckHalf: 16 };
    case "paper":
      return { ...base, bodyHalf: 46, shoulderY: 72 };
    case "food":
      return { ...base, bodyHalf: 50, shoulderY: 74, bottomR: 28 };
    default:
      return base;
  }
}

/** 瓶の外形パス（コルクの下〜底までの一体シルエット） */
function bottlePath(s: BottleShape): string {
  const cx = 100;
  const { neckHalf: n, shoulderY: sh, bodyHalf: b, topY: t, bottomY: bt, bottomR: r } = s;
  // 上端 → 首 → 肩のカーブ → 胴 → 底の丸み
  return `
    M ${cx - n} ${t}
    L ${cx - n} ${sh - 8}
    C ${cx - n} ${sh + 4}, ${cx - b} ${sh - 2}, ${cx - b} ${sh + 10}
    L ${cx - b} ${bt - r}
    C ${cx - b} ${bt}, ${cx - b + r * 0.6} ${bt}, ${cx - r * 0.3} ${bt}
    L ${cx + r * 0.3} ${bt}
    C ${cx + b - r * 0.6} ${bt}, ${cx + b} ${bt}, ${cx + b} ${bt - r}
    L ${cx + b} ${sh + 10}
    C ${cx + b} ${sh - 2}, ${cx + n} ${sh + 4}, ${cx + n} ${sh - 8}
    L ${cx + n} ${t}
    Z
  `;
}

/* ===================== 合成 ===================== */

export function renderMonomonSVG(spec: MonomonSpec): string {
  const species = getSpecies(spec.speciesId);
  const p = spec.palette;
  const gid = `g${(spec.seed % 1000000).toString(36)}`;
  const glassId = `glass${gid}`;
  const glowId = `glow${gid}`;
  const sparkleId = `spk${gid}`;

  const shape = shapeFor(spec.seed, species.family);
  const cx = 100;
  const bodyCy = (shape.shoulderY + shape.bottomY) / 2 + shape.faceOffset;

  // 目・口の位置（瓶の下半分〜中央）
  const faceCy = bodyCy - 4;
  const faceSpread = 15;
  const faceSize = 10.5;

  const eyeSvg = eyes(spec.eyes, cx, faceCy, faceSpread, faceSize);
  const mouthSvg = mouth(spec.mouth, cx, faceCy + faceSize * 1.6);

  // ほっぺ（表情に合わせて濃さを変える）
  const blushAlpha = spec.eyes === "closed" || spec.eyes === "sleepy" ? 0.6 : 0.42;
  const cheeks = `
    <ellipse cx="${cx - faceSpread - 8}" cy="${faceCy + faceSize * 0.9}" rx="7" ry="4.5" fill="#ff9aa2" opacity="${blushAlpha}"/>
    <ellipse cx="${cx + faceSpread + 8}" cy="${faceCy + faceSize * 0.9}" rx="7" ry="4.5" fill="#ff9aa2" opacity="${blushAlpha}"/>
  `;

  // コルクの栓（上部）
  const corkW = shape.neckHalf + 6;
  const corkH = shape.corkH;
  const corkY = shape.topY - corkH;
  const cork = `
    <rect x="${cx - corkW}" y="${corkY}" width="${corkW * 2}" height="${corkH}" rx="6" fill="#c8935a"/>
    <rect x="${cx - corkW}" y="${corkY}" width="${corkW * 2}" height="${corkH * 0.35}" rx="6" fill="#d9a771"/>
    <rect x="${cx - corkW - 2}" y="${shape.topY - 3}" width="${(corkW + 2) * 2}" height="5" rx="2" fill="#7a5230"/>
  `;

  // 首の赤い札（お守り）
  const tag = `
    <path d="M ${cx + shape.neckHalf - 2} ${shape.topY + 6} q 8 4 12 12 q 2 4 -1 5 q -6 2 -14 -4" fill="#c8342f"/>
    <circle cx="${cx + shape.neckHalf + 8}" cy="${shape.topY + 9}" r="2" fill="#f7d9b5"/>
    <path d="M ${cx + shape.neckHalf - 2} ${shape.topY + 6} q 6 8 8 12" fill="none" stroke="#8a1f1c" stroke-width="1.2"/>
  `;

  // 手足（小さな赤いミトンとつま先）
  const armY = shape.shoulderY + (shape.bottomY - shape.shoulderY) * 0.35;
  const armX = shape.bodyHalf;
  const arms = `
    <ellipse cx="${cx - armX - 2}" cy="${armY + 6}" rx="7" ry="6" fill="#c8342f"/>
    <ellipse cx="${cx + armX + 2}" cy="${armY + 6}" rx="7" ry="6" fill="#c8342f"/>
  `;
  const feetY = shape.bottomY - 2;
  const feet = `
    <ellipse cx="${cx - 14}" cy="${feetY + 4}" rx="8" ry="4" fill="#7a2320" opacity="0.7"/>
    <ellipse cx="${cx + 14}" cy="${feetY + 4}" rx="8" ry="4" fill="#7a2320" opacity="0.7"/>
  `;

  // 内側の星屑（ガラス瓶の中の小さな光）
  const innerStars = (() => {
    let out = "";
    let seed = spec.seed;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967295;
    };
    const count = 8;
    for (let i = 0; i < count; i++) {
      const x = cx + (rand() - 0.5) * shape.bodyHalf * 1.4;
      const y = shape.shoulderY + rand() * (shape.bottomY - shape.shoulderY - 10);
      const r = 0.8 + rand() * 1.4;
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.35 + rand() * 0.45).toFixed(2)}"/>`;
    }
    return out;
  })();

  // ハイライト（左肩の光沢と右下の反射）
  const highlight = `
    <path d="M ${cx - shape.bodyHalf * 0.7} ${shape.shoulderY + 14}
             Q ${cx - shape.bodyHalf * 0.85} ${shape.bottomY * 0.55}
               ${cx - shape.bodyHalf * 0.5} ${shape.bottomY - 24}"
      stroke="#ffffff" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.28"/>
    <ellipse cx="${cx + shape.bodyHalf * 0.55}" cy="${shape.bottomY - 22}" rx="8" ry="12"
      fill="#ffffff" opacity="0.14"/>
  `;

  // 底の影
  const shadow = `<ellipse cx="${cx}" cy="${shape.bottomY + 10}" rx="${shape.bodyHalf * 0.9}" ry="5" fill="#000" opacity="0.16"/>`;

  const bodyD = bottlePath(shape);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 200 210" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
<defs>
  <linearGradient id="${glassId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${p.c1}" stop-opacity="0.9"/>
    <stop offset="55%" stop-color="${p.c2}" stop-opacity="0.95"/>
    <stop offset="100%" stop-color="${p.c3}" stop-opacity="1"/>
  </linearGradient>
  <radialGradient id="${glowId}" cx="50%" cy="55%" r="55%">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
    <stop offset="60%" stop-color="${p.c1}" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="${p.c3}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="${sparkleId}" cx="50%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#fff" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
</defs>
${shadow}
${arms}
${feet}
<!-- 瓶本体（ガラス） -->
<path d="${bodyD}" fill="url(#${glassId})" stroke="${p.line}" stroke-width="2" stroke-linejoin="round"/>
<!-- 内側の柔らかな発光 -->
<path d="${bodyD}" fill="url(#${glowId})" opacity="0.9"/>
<!-- 内側の星屑 -->
${innerStars}
<!-- 表面のハイライト -->
${highlight}
<!-- 上端の光沢帯 -->
<path d="${bodyD}" fill="url(#${sparkleId})" opacity="0.5"/>
${cork}
${tag}
${cheeks}
${eyeSvg}
${mouthSvg}
</svg>`;
}

/** MonomonSpec（renderMonomonSVG が受け取るスペック）に含まれない
 * 情報は不要。追加のパラメータで見た目が破綻しないようにしています。 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// legacy exports (retain typing for callers)
export type { Accessory, EyeStyle, MonomonSpec, MouthStyle, Palette };
