/**
 * モノモンの姿をSVGで手続き的に描きます。
 *
 * 流れ：種族（species.ts）がモノのシルエットを描く
 *   → 個体の配色・目・口・模様・アクセサリー・ポーズを重ねる。
 * 同じ spec なら必ず同じ姿（再現性あり）。
 *
 * ※ これは AI 画像生成ではなく、温かみのあるプロシージャル描画です。
 *    将来 generateMonomon() の中身を本物の画像生成APIに差し替えても、
 *    この表示モジュールはそのまま使えます。
 */

import type {
  Accessory,
  EyeStyle,
  MonomonSpec,
  MouthStyle,
  Palette,
  PatternKind,
  Pose,
} from "./monomon-data";
import { getSpecies, type SpeciesArt } from "./species";

const EYE = "#42352c";

/* ===================== 顔 ===================== */

function drawEyes(eyes: EyeStyle, cx: number, cy: number, sp: number, sz: number): string {
  const lx = cx - sp;
  const rx = cx + sp;

  const round = (x: number, big = false) => {
    const r = big ? sz * 1.12 : sz;
    return `<ellipse cx="${x}" cy="${cy}" rx="${(r * 0.82).toFixed(1)}" ry="${r.toFixed(1)}" fill="${EYE}"/><circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.38).toFixed(1)}" r="${(r * 0.3).toFixed(1)}" fill="#fff"/>`;
  };
  const sparkle = (x: number) =>
    `<ellipse cx="${x}" cy="${cy}" rx="${(sz * 0.92).toFixed(1)}" ry="${(sz * 1.12).toFixed(1)}" fill="${EYE}"/><circle cx="${(x - sz * 0.3).toFixed(1)}" cy="${(cy - sz * 0.42).toFixed(1)}" r="${(sz * 0.34).toFixed(1)}" fill="#fff"/><circle cx="${(x + sz * 0.35).toFixed(1)}" cy="${(cy + sz * 0.32).toFixed(1)}" r="${(sz * 0.18).toFixed(1)}" fill="#fff" opacity="0.9"/>`;
  const dot = (x: number) => `<circle cx="${x}" cy="${cy}" r="${(sz * 0.55).toFixed(1)}" fill="${EYE}"/>`;
  const oval = (x: number) => `<ellipse cx="${x}" cy="${cy}" rx="${(sz * 0.55).toFixed(1)}" ry="${(sz * 1.05).toFixed(1)}" fill="${EYE}"/><circle cx="${(x - sz * 0.2).toFixed(1)}" cy="${(cy - sz * 0.4).toFixed(1)}" r="${(sz * 0.22).toFixed(1)}" fill="#fff"/>`;
  const happy = (x: number) => `<path d="M ${x - sz} ${cy + 2} Q ${x} ${cy - sz} ${x + sz} ${cy + 2}" fill="none" stroke="${EYE}" stroke-width="3.2" stroke-linecap="round"/>`;
  const sleepy = (x: number) => `<path d="M ${x - sz} ${cy - 1} Q ${x} ${cy + sz * 0.7} ${x + sz} ${cy - 1}" fill="none" stroke="${EYE}" stroke-width="3.2" stroke-linecap="round"/>`;
  const star = (x: number) => {
    let d = "";
    for (let i = 0; i < 5; i++) {
      const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = a1 + Math.PI / 5;
      d += `${i === 0 ? "M" : "L"} ${(x + Math.cos(a1) * sz).toFixed(1)} ${(cy + Math.sin(a1) * sz).toFixed(1)} L ${(x + Math.cos(a2) * sz * 0.45).toFixed(1)} ${(cy + Math.sin(a2) * sz * 0.45).toFixed(1)} `;
    }
    return `<path d="${d}Z" fill="${EYE}"/>`;
  };
  const cross = (x: number) =>
    `<path d="M ${x - sz * 0.6} ${cy - sz * 0.6} l ${sz * 1.2} ${sz * 1.2} M ${x + sz * 0.6} ${cy - sz * 0.6} l ${-sz * 1.2} ${sz * 1.2}" stroke="${EYE}" stroke-width="3" stroke-linecap="round"/>`;

  switch (eyes) {
    case "round": return round(lx) + round(rx);
    case "sparkle": return sparkle(lx) + sparkle(rx);
    case "dot": return dot(lx) + dot(rx);
    case "oval": return oval(lx) + oval(rx);
    case "wink": return happy(lx) + round(rx, true);
    case "closed": return happy(lx) + happy(rx);
    case "sleepy": return sleepy(lx) + sleepy(rx);
    case "starry": return star(lx) + star(rx);
    case "cross": return cross(lx) + cross(rx);
    default: return round(lx) + round(rx);
  }
}

function drawMouth(mouth: MouthStyle, cx: number, my: number): string {
  switch (mouth) {
    case "smile": return `<path d="M ${cx - 7} ${my} Q ${cx} ${my + 7} ${cx + 7} ${my}" fill="none" stroke="${EYE}" stroke-width="2.6" stroke-linecap="round"/>`;
    case "open": return `<path d="M ${cx - 8} ${my - 2} Q ${cx} ${my + 11} ${cx + 8} ${my - 2} Z" fill="#e8607a"/><path d="M ${cx - 8} ${my - 2} Q ${cx} ${my + 11} ${cx + 8} ${my - 2}" fill="none" stroke="${EYE}" stroke-width="2.2" stroke-linejoin="round"/>`;
    case "cat": return `<path d="M ${cx - 8} ${my} Q ${cx - 4} ${my + 5} ${cx} ${my} Q ${cx + 4} ${my + 5} ${cx + 8} ${my}" fill="none" stroke="${EYE}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "small": return `<path d="M ${cx - 3.5} ${my} Q ${cx} ${my + 3.5} ${cx + 3.5} ${my}" fill="none" stroke="${EYE}" stroke-width="2.4" stroke-linecap="round"/>`;
    case "grin": return `<path d="M ${cx - 10} ${my - 1} Q ${cx} ${my + 9} ${cx + 10} ${my - 1} Z" fill="#fff"/><path d="M ${cx - 10} ${my - 1} Q ${cx} ${my + 9} ${cx + 10} ${my - 1}" fill="none" stroke="${EYE}" stroke-width="2.4" stroke-linejoin="round"/>`;
    case "ooh": return `<ellipse cx="${cx}" cy="${my + 1}" rx="4" ry="5" fill="${EYE}"/>`;
    case "tongue": return `<path d="M ${cx - 7} ${my} Q ${cx} ${my + 6} ${cx + 7} ${my}" fill="none" stroke="${EYE}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="${cx + 2}" cy="${my + 5}" rx="3.5" ry="3" fill="#e8607a"/>`;
    default: return `<path d="M ${cx - 7} ${my} Q ${cx} ${my + 7} ${cx + 7} ${my}" fill="none" stroke="${EYE}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
}

/* ===================== 模様 ===================== */

function drawPattern(kind: PatternKind, art: SpeciesArt, p: Palette): string {
  if (kind === "none") return "";
  const cx = art.face.cx;
  const by = art.face.cy + art.face.size * 2.6;
  const hw = art.bottom.halfW;
  if (hw < 22 && kind !== "heart" && kind !== "freckle") return "";
  switch (kind) {
    case "dots": {
      let s = "";
      for (let i = -1; i <= 1; i++)
        s += `<circle cx="${cx + i * 16}" cy="${by}" r="3.4" fill="#fffdf6" opacity="0.85"/>`;
      return s;
    }
    case "stripes":
      return `<g stroke="${p.c3}" stroke-width="3" opacity="0.5" stroke-linecap="round"><path d="M ${cx - hw * 0.6} ${by - 6} h ${hw * 1.2}"/><path d="M ${cx - hw * 0.6} ${by + 2} h ${hw * 1.2}"/></g>`;
    case "spots":
      return `<circle cx="${cx - 14}" cy="${by - 4}" r="5" fill="${p.c3}" opacity="0.55"/><circle cx="${cx + 12}" cy="${by + 4}" r="4" fill="${p.c3}" opacity="0.55"/>`;
    case "heart":
      return `<path d="M ${cx} ${by + 4} q -7 -8 -7 -1 q 0 5 7 9 q 7 -4 7 -9 q 0 -7 -7 1 Z" fill="${p.cheek}"/>`;
    case "freckle":
      return `<g fill="${p.c3}" opacity="0.6"><circle cx="${cx - art.face.spread - 8}" cy="${art.face.cy + 4}" r="1.6"/><circle cx="${cx - art.face.spread - 12}" cy="${art.face.cy + 8}" r="1.4"/><circle cx="${cx + art.face.spread + 8}" cy="${art.face.cy + 4}" r="1.6"/><circle cx="${cx + art.face.spread + 12}" cy="${art.face.cy + 8}" r="1.4"/></g>`;
    default:
      return "";
  }
}

/* ===================== アクセサリー ===================== */

function drawAccessory(acc: Accessory, hx: number, hy: number, p: Palette): string {
  switch (acc) {
    case "leaf":
      return `<path d="M ${hx} ${hy} q -3 -16 -16 -18 q 1 14 16 18 Z" fill="#79cf94"/><path d="M ${hx} ${hy} q 3 -14 14 -16 q -1 12 -14 16 Z" fill="#92d9a6"/>`;
    case "bow":
      return `<g transform="translate(${hx} ${hy - 4})"><path d="M 0 0 L -14 -8 L -14 8 Z" fill="${p.cheek}"/><path d="M 0 0 L 14 -8 L 14 8 Z" fill="${p.cheek}"/><circle r="4" fill="${p.c3}"/></g>`;
    case "star":
      return `<path d="M ${hx} ${hy - 18} l 3 7 l 8 1 l -6 5 l 2 8 l -7 -4 l -7 4 l 2 -8 l -6 -5 l 8 -1 Z" fill="#ffd76b" stroke="#e8b53c" stroke-width="1"/>`;
    case "antenna":
      return `<line x1="${hx}" y1="${hy}" x2="${hx}" y2="${hy - 16}" stroke="${p.c3}" stroke-width="2.6" stroke-linecap="round"/><circle cx="${hx}" cy="${hy - 18}" r="4.5" fill="${p.cheek}"/>`;
    case "flower":
      return `<g transform="translate(${hx} ${hy - 8})"><circle cx="-7" r="4.5" fill="#fff3c0"/><circle cx="7" r="4.5" fill="#fff3c0"/><circle cy="-7" r="4.5" fill="#fff3c0"/><circle cy="7" r="4.5" fill="#fff3c0"/><circle r="4" fill="${p.cheek}"/></g>`;
    case "crown":
      return `<path d="M ${hx - 16} ${hy - 2} L ${hx - 16} ${hy - 16} L ${hx - 6} ${hy - 8} L ${hx} ${hy - 18} L ${hx + 6} ${hy - 8} L ${hx + 16} ${hy - 16} L ${hx + 16} ${hy - 2} Z" fill="#ffd76b" stroke="#e8b53c" stroke-width="1.2" stroke-linejoin="round"/>`;
    case "halo":
      return `<ellipse cx="${hx}" cy="${hy - 16}" rx="16" ry="5" fill="none" stroke="#ffe27a" stroke-width="3.5" opacity="0.95"/>`;
    case "hat":
      return `<g transform="translate(${hx} ${hy})"><rect x="-16" y="-2" width="32" height="5" rx="2.5" fill="${p.line}"/><rect x="-10" y="-18" width="20" height="18" rx="3" fill="${p.line}"/><rect x="-10" y="-7" width="20" height="4" fill="${p.cheek}"/></g>`;
    default:
      return "";
  }
}

/* ===================== 手足・ポーズ ===================== */

function drawLimbs(art: SpeciesArt, p: Palette, pose: Pose): string {
  let s = "";
  const cx = art.face.cx;
  const fy = art.bottom.y - 2;
  const fhw = art.bottom.halfW;

  if (art.feet !== false && fhw > 4) {
    const spread = fhw * 0.55;
    const lift = pose === "jump" ? 6 : 0;
    const fx = pose === "jump" ? spread + 6 : spread;
    s += `<ellipse cx="${cx - fx}" cy="${fy - lift}" rx="11" ry="7" fill="${p.c3}"/><ellipse cx="${cx + fx}" cy="${fy - lift}" rx="11" ry="7" fill="${p.c3}"/>`;
  }

  if (art.arms !== false) {
    const ay = (art.face.cy + art.bottom.y) / 2;
    const ahw = Math.max(art.bottom.halfW, art.face.spread + 10) + 2;
    const arm = (x: number, up: boolean, sign: number) =>
      up
        ? `<ellipse cx="${x + sign * 4}" cy="${ay - 12}" rx="6.5" ry="10" transform="rotate(${sign * 40} ${x} ${ay})" fill="${p.c3}"/>`
        : `<ellipse cx="${x}" cy="${ay}" rx="6.5" ry="10" transform="rotate(${sign * 18} ${x} ${ay})" fill="${p.c3}"/>`;
    const leftUp = pose === "cheer";
    const rightUp = pose === "cheer" || pose === "wave";
    s = `${arm(cx - ahw, leftUp, -1)}${arm(cx + ahw, rightUp, 1)}` + s;
  }
  return s;
}

/* ===================== 合成 ===================== */

export function renderMonomonSVG(spec: MonomonSpec): string {
  const species = getSpecies(spec.speciesId);
  const p = spec.palette;
  const gid = `g${(spec.seed % 1000000).toString(36)}`;
  const fill = `url(#${gid})`;

  // 種族ごとの乱数（わずかな形のゆらぎ用）
  let a = (spec.seed ^ 0x9e3779b9) >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const art = species.draw({ rng, p, fill });

  const face = art.face;
  const eyes = drawEyes(spec.eyes, face.cx, face.cy, face.spread, face.size);
  const mouth = drawMouth(spec.mouth, face.cx, face.cy + face.size * 1.7);
  const blush = spec.eyes === "closed" || spec.eyes === "sleepy" ? 0.7 : 0.5;
  const cheeks = `<ellipse cx="${face.cx - face.spread - face.size * 0.5}" cy="${face.cy + face.size * 0.7}" rx="${face.size * 0.7}" ry="${face.size * 0.5}" fill="${p.cheek}" opacity="${blush}"/><ellipse cx="${face.cx + face.spread + face.size * 0.5}" cy="${face.cy + face.size * 0.7}" rx="${face.size * 0.7}" ry="${face.size * 0.5}" fill="${p.cheek}" opacity="${blush}"/>`;

  const pattern = drawPattern(spec.pattern, art, p);
  const accessory = drawAccessory(spec.accessory, art.headTop.x, art.headTop.y, p);
  const limbs = drawLimbs(art, p, spec.pose);

  const shadow = `<ellipse cx="100" cy="${art.bottom.y + 8}" rx="${Math.max(art.bottom.halfW, 30) * 0.95}" ry="8" fill="#000" opacity="0.07"/>`;
  const sparkles = `<g fill="#fff8e0" opacity="0.85"><path d="M 34 60 l 1.6 4 l 4 1.6 l -4 1.6 l -1.6 4 l -1.6 -4 l -4 -1.6 l 4 -1.6 z"/><path d="M 168 70 l 1.3 3.4 l 3.4 1.3 l -3.4 1.3 l -1.3 3.4 l -1.3 -3.4 l -3.4 -1.3 l 3.4 -1.3 z"/></g>`;

  const tilt = spec.pose === "tilt" ? ` transform="rotate(-5 100 116)"` : "";

  // viewBox に上下の余白を持たせ、王冠・葉・触角などの装飾が絶対に切れないようにする
  // （キャラは縦中央に contain 配置される）
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 10 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
<defs>
<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="${p.c1}"/>
<stop offset="100%" stop-color="${p.c2}"/>
</linearGradient>
</defs>
${shadow}
${sparkles}
<g${tilt}>
${limbs}
${art.back ?? ""}
${art.body}
${art.front ?? ""}
${pattern}
${cheeks}
${eyes}
${mouth}
${accessory}
</g>
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
