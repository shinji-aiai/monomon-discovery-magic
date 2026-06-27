import {
  CATEGORY_STYLES,
  type BodyShape,
  type Expression,
  type MonomonSpec,
} from "./monomon-data";

/**
 * モノモンの「かわいいイラスト」をSVGで手続き的に生成します。
 * 同じ spec なら必ず同じ姿になります（再現性あり）。
 *
 * ・体型（シルエット）で区別できる
 * ・表情は性格に合わせて変わる
 * ・特徴パーツ（持ち手=耳、湯気=髪、葉=耳など）でモノとのつながりを表現
 *
 * ※ これは AI 画像生成ではなく、温かみのあるイラスト風の
 *    プロシージャル描画です。将来 generateMonomon() の中で
 *    本物の画像生成APIに差し替えても、表示側はこのまま使えます。
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CX = 100;
const FACE = "#4a3b32";

interface ShapeGeom {
  halfW: number;
  halfH: number;
  cy: number;
  /** 角の丸み（大きいほど四角い）2=楕円 */
  n: number;
}

const SHAPE_GEOM: Record<BodyShape, ShapeGeom> = {
  round: { halfW: 55, halfH: 56, cy: 112, n: 2.0 },
  square: { halfW: 56, halfH: 56, cy: 112, n: 3.4 },
  tall: { halfW: 43, halfH: 66, cy: 108, n: 2.6 },
  wide: { halfW: 70, halfH: 47, cy: 118, n: 2.7 },
  fluffy: { halfW: 57, halfH: 55, cy: 113, n: 2.0 },
  bean: { halfW: 47, halfH: 64, cy: 110, n: 2.3 },
  stout: { halfW: 66, halfH: 49, cy: 120, n: 3.0 },
};

/** スーパー楕円（角丸四角〜楕円）の輪郭を作る。fluffy は波打たせる。 */
function bodyPath(
  rng: () => number,
  g: ShapeGeom,
  shape: BodyShape,
): string {
  const count = 64;
  const phase = rng() * Math.PI * 2;
  const fluffy = shape === "fluffy";
  const bean = shape === "bean";
  let d = "";
  for (let i = 0; i <= count; i++) {
    const t = (i / count) * Math.PI * 2 - Math.PI / 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const ex = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / g.n);
    const ey = Math.sign(st) * Math.pow(Math.abs(st), 2 / g.n);
    let wob = 1 + Math.sin(t * 3 + phase) * 0.012;
    if (fluffy) wob += Math.sin(t * 9 + phase) * 0.05 + Math.sin(t * 5) * 0.02;
    // bean: 片側をふくらませる
    const beanShift = bean ? Math.sin(t) * 6 + Math.cos(t * 2) * 4 : 0;
    const x = CX + ex * g.halfW * wob + beanShift;
    const y = g.cy + ey * g.halfH * wob;
    d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d + "Z";
}

function drawEyes(
  rng: () => number,
  expr: Expression,
  eyeY: number,
  dx: number,
): string {
  const lx = CX - dx;
  const rx = CX + dx;
  const big = expr === "energetic" || expr === "surprised";
  const er = big ? 13 : 11;

  const closedArc = (x: number, down: boolean) =>
    down
      ? `<path d="M ${x - 9} ${eyeY - 2} Q ${x} ${eyeY + 6} ${x + 9} ${eyeY - 2}" fill="none" stroke="${FACE}" stroke-width="3.4" stroke-linecap="round"/>`
      : `<path d="M ${x - 9} ${eyeY + 2} Q ${x} ${eyeY - 7} ${x + 9} ${eyeY + 2}" fill="none" stroke="${FACE}" stroke-width="3.4" stroke-linecap="round"/>`;

  const openEye = (x: number, sparkle: boolean, look: number) => {
    const gleam = sparkle
      ? `<circle cx="${x - 3 + look}" cy="${eyeY - 4}" r="3.4" fill="#fff"/><circle cx="${x + 3.5}" cy="${eyeY + 3}" r="1.7" fill="#fff" opacity="0.9"/>`
      : `<circle cx="${x - 3 + look}" cy="${eyeY - 3.5}" r="3" fill="#fff"/>`;
    return `<ellipse cx="${x}" cy="${eyeY}" rx="${er * 0.82}" ry="${er}" fill="${FACE}"/>${gleam}`;
  };

  switch (expr) {
    case "sleepy":
      return closedArc(lx, true) + closedArc(rx, true);
    case "shy":
      // 下を向いた小さめの目
      return openEye(lx, false, -2) + openEye(rx, false, -2);
    case "gentle":
      return closedArc(lx, false) + closedArc(rx, false);
    case "mischief":
      // 片目ウインク
      return closedArc(lx, false) + openEye(rx, true, 1);
    case "serious": {
      const bar = (x: number) =>
        `<rect x="${x - 7}" y="${eyeY - 6}" width="14" height="12" rx="5" fill="${FACE}"/><circle cx="${x - 2}" cy="${eyeY - 2}" r="2.2" fill="#fff"/>`;
      return bar(lx) + bar(rx);
    }
    case "surprised":
      return (
        `<ellipse cx="${lx}" cy="${eyeY}" rx="${er}" ry="${er + 2}" fill="${FACE}"/><circle cx="${lx - 2}" cy="${eyeY - 4}" r="3.2" fill="#fff"/>` +
        `<ellipse cx="${rx}" cy="${eyeY}" rx="${er}" ry="${er + 2}" fill="${FACE}"/><circle cx="${rx - 2}" cy="${eyeY - 4}" r="3.2" fill="#fff"/>`
      );
    case "energetic":
      return openEye(lx, true, 0) + openEye(rx, true, 0);
    default:
      return openEye(lx, rng() > 0.6, 0) + openEye(rx, rng() > 0.6, 0);
  }
}

function drawMouth(expr: Expression, my: number): string {
  switch (expr) {
    case "sleepy":
      return `<ellipse cx="${CX}" cy="${my + 1}" rx="4.5" ry="5.5" fill="${FACE}"/>`;
    case "shy":
      return `<path d="M ${CX - 5} ${my} Q ${CX} ${my + 4} ${CX + 5} ${my}" fill="none" stroke="${FACE}" stroke-width="2.6" stroke-linecap="round"/>`;
    case "gentle":
      return `<path d="M ${CX - 8} ${my} Q ${CX} ${my + 7} ${CX + 8} ${my}" fill="none" stroke="${FACE}" stroke-width="2.8" stroke-linecap="round"/>`;
    case "mischief":
      return `<path d="M ${CX - 11} ${my - 1} Q ${CX - 5} ${my + 7} ${CX} ${my + 1} Q ${CX + 5} ${my + 7} ${CX + 11} ${my - 1}" fill="none" stroke="${FACE}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "serious":
      return `<path d="M ${CX - 8} ${my + 2} L ${CX + 8} ${my + 2}" fill="none" stroke="${FACE}" stroke-width="2.8" stroke-linecap="round"/>`;
    case "surprised":
      return `<ellipse cx="${CX}" cy="${my + 2}" rx="5" ry="6.5" fill="${FACE}"/>`;
    case "energetic":
      return `<path d="M ${CX - 10} ${my - 2} Q ${CX} ${my + 12} ${CX + 10} ${my - 2} Z" fill="#e8607a"/><path d="M ${CX - 10} ${my - 2} Q ${CX} ${my + 12} ${CX + 10} ${my - 2}" fill="none" stroke="${FACE}" stroke-width="2.4" stroke-linejoin="round"/>`;
    default:
      return `<path d="M ${CX - 9} ${my} Q ${CX} ${my + 9} ${CX + 9} ${my}" fill="none" stroke="${FACE}" stroke-width="2.8" stroke-linecap="round"/>`;
  }
}

export function renderMonomonSVG(spec: MonomonSpec): string {
  const rng = mulberry32(spec.seed >>> 0);
  const style = CATEGORY_STYLES[spec.category];
  const [c1, c2] = style.body;
  const cheek = style.cheek;
  const g = SHAPE_GEOM[spec.shape];

  const top = g.cy - g.halfH; // 頭頂
  const bottom = g.cy + g.halfH;
  const leftEdge = CX - g.halfW;
  const rightEdge = CX + g.halfW;

  const body = bodyPath(rng, g, spec.shape);

  const eyeY = g.cy - g.halfH * 0.12;
  const eyeDX = Math.min(g.halfW * 0.42, 24);
  const eyes = drawEyes(rng, spec.expression, eyeY, eyeDX);
  const mouth = drawMouth(spec.expression, eyeY + 24);

  const blushOpacity = spec.expression === "shy" ? 0.75 : 0.5;
  const blushR = spec.expression === "shy" ? 9.5 : 8;
  const cheeks = `<ellipse cx="${CX - eyeDX - 6}" cy="${eyeY + 12}" rx="${blushR}" ry="${blushR * 0.7}" fill="${cheek}" opacity="${blushOpacity}"/><ellipse cx="${CX + eyeDX + 6}" cy="${eyeY + 12}" rx="${blushR}" ry="${blushR * 0.7}" fill="${cheek}" opacity="${blushOpacity}"/>`;

  // ===== 特徴パーツ：髪（モノの上部の特徴）=====
  let hair = "";
  if (spec.hair === "steam") {
    const wisp = (ox: number, h: number) =>
      `<path d="M ${CX + ox} ${top + 4} q -7 -${h * 0.4} 0 -${h * 0.7} q 7 -${h * 0.3} 0 -${h}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.85"/>`;
    hair = wisp(-14, 30) + wisp(2, 38) + wisp(16, 28);
  } else if (spec.hair === "leaf") {
    hair = `<path d="M ${CX} ${top + 6} q -20 -8 -22 -28 q 20 -2 22 18" fill="#8fd6a6"/><path d="M ${CX} ${top + 6} q 18 -10 22 -26 q -18 -4 -22 16" fill="#a8e6c0"/><path d="M ${CX} ${top + 6} q 0 -20 0 -30 q 8 8 0 26" fill="#79cf94"/>`;
  } else if (spec.hair === "tissue") {
    hair = `<path d="M ${CX - 20} ${top + 6} q -4 -26 14 -28 q 6 -14 14 0 q 18 0 14 28 q -14 8 -28 0 q -10 6 -14 0 z" fill="#ffffff" stroke="#e8e2d6" stroke-width="1.5"/>`;
  } else if (spec.hair === "sprout") {
    hair = `<line x1="${CX}" y1="${top + 4}" x2="${CX}" y2="${top - 16}" stroke="#79b87a" stroke-width="3.4" stroke-linecap="round"/><path d="M ${CX} ${top - 12} q -14 -2 -16 -14 q 14 -2 16 10" fill="#8fd6a6"/><path d="M ${CX} ${top - 16} q 12 -2 14 -13 q -12 -3 -14 9" fill="#a8e6c0"/>`;
  } else if (spec.hair === "tuft") {
    hair = `<path d="M ${CX - 4} ${top + 6} q -8 -18 6 -24 q -2 6 2 12 q 6 -6 10 -2 q -6 6 -8 16" fill="${c2}"/>`;
  } else if (spec.hair === "hands") {
    // 時計の針が髪に
    hair =
      `<line x1="${CX}" y1="${top + 4}" x2="${CX - 4}" y2="${top - 20}" stroke="${c2}" stroke-width="3.6" stroke-linecap="round"/>` +
      `<line x1="${CX}" y1="${top + 4}" x2="${CX + 14}" y2="${top - 8}" stroke="${c2}" stroke-width="3.6" stroke-linecap="round"/>` +
      `<circle cx="${CX}" cy="${top + 4}" r="3.4" fill="${c2}"/>`;
  }

  // ===== 耳（モノの持ち手・葉など）=====
  let ears = "";
  if (spec.ears === "handle") {
    const earY = g.cy - 4;
    ears =
      `<path d="M ${leftEdge + 6} ${earY - 16} a 16 18 0 1 0 0 32" fill="none" stroke="${c2}" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M ${rightEdge - 6} ${earY - 16} a 16 18 0 1 1 0 32" fill="none" stroke="${c2}" stroke-width="9" stroke-linecap="round"/>`;
  } else if (spec.ears === "round") {
    ears =
      `<ellipse cx="${CX - g.halfW * 0.66}" cy="${top + 12}" rx="13" ry="15" fill="${c2}"/><ellipse cx="${CX - g.halfW * 0.66}" cy="${top + 13}" rx="6" ry="7.5" fill="${cheek}" opacity="0.55"/>` +
      `<ellipse cx="${CX + g.halfW * 0.66}" cy="${top + 12}" rx="13" ry="15" fill="${c2}"/><ellipse cx="${CX + g.halfW * 0.66}" cy="${top + 13}" rx="6" ry="7.5" fill="${cheek}" opacity="0.55"/>`;
  } else if (spec.ears === "leaf") {
    ears =
      `<path d="M ${CX - g.halfW * 0.7} ${top + 16} q -22 -10 -26 -30 q 22 -2 26 22" fill="#8fd6a6"/>` +
      `<path d="M ${CX + g.halfW * 0.7} ${top + 16} q 22 -10 26 -30 q -22 -2 -26 22" fill="#8fd6a6"/>`;
  }

  // ===== しっぽ（ホース・花など）=====
  let tail = "";
  if (spec.tail === "hose") {
    tail = `<path d="M ${rightEdge - 8} ${bottom - 14} q 32 8 30 -18 q -2 -18 -18 -14" fill="none" stroke="${c2}" stroke-width="8" stroke-linecap="round"/><circle cx="${rightEdge + 4}" cy="${bottom - 36}" r="6" fill="${c2}"/>`;
  } else if (spec.tail === "flower") {
    const fx = rightEdge - 2;
    const fy = bottom - 20;
    tail =
      `<path d="M ${fx} ${fy} q 22 0 30 -20" fill="none" stroke="#79b87a" stroke-width="4" stroke-linecap="round"/>` +
      `<g transform="translate(${fx + 32} ${fy - 22})"><circle r="6" fill="${cheek}"/><circle cx="-9" cy="0" r="5" fill="#fff3c0"/><circle cx="9" cy="0" r="5" fill="#fff3c0"/><circle cx="0" cy="-9" r="5" fill="#fff3c0"/><circle cx="0" cy="9" r="5" fill="#fff3c0"/></g>`;
  } else if (spec.tail === "curl") {
    tail = `<path d="M ${rightEdge - 6} ${bottom - 12} q 24 4 20 -14 q -3 -12 -14 -6" fill="none" stroke="${c2}" stroke-width="6" stroke-linecap="round"/>`;
  }

  // ===== おなか（時計の文字盤・ポケット・ボタン）=====
  let belly = "";
  const bcy = g.cy + g.halfH * 0.32;
  if (spec.belly === "clock") {
    const r = Math.min(g.halfW, g.halfH) * 0.44;
    let ticks = "";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ticks += `<circle cx="${CX + Math.cos(a) * r * 0.8}" cy="${bcy + Math.sin(a) * r * 0.8}" r="1.2" fill="${c2}"/>`;
    }
    belly = `<circle cx="${CX}" cy="${bcy}" r="${r}" fill="#fffaf0" stroke="${c2}" stroke-width="2.5"/>${ticks}<line x1="${CX}" y1="${bcy}" x2="${CX}" y2="${bcy - r * 0.6}" stroke="${FACE}" stroke-width="2.4" stroke-linecap="round"/><line x1="${CX}" y1="${bcy}" x2="${CX + r * 0.5}" y2="${bcy}" stroke="${FACE}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${CX}" cy="${bcy}" r="2.2" fill="${FACE}"/>`;
  } else if (spec.belly === "pocket") {
    const w = g.halfW * 0.62;
    belly = `<path d="M ${CX - w} ${bcy - 8} L ${CX + w} ${bcy - 8} L ${CX + w} ${bcy + 12} Q ${CX} ${bcy + 22} ${CX - w} ${bcy + 12} Z" fill="none" stroke="${c2}" stroke-width="2.6" opacity="0.7" stroke-linejoin="round"/>`;
  } else if (spec.belly === "button") {
    belly = `<circle cx="${CX}" cy="${bcy}" r="6" fill="#fffaf0" stroke="${c2}" stroke-width="2.4"/>`;
  }

  // ===== 手足・影・きらきら =====
  const feet = `<ellipse cx="${CX - g.halfW * 0.42}" cy="${bottom - 4}" rx="12" ry="7.5" fill="${c2}"/><ellipse cx="${CX + g.halfW * 0.42}" cy="${bottom - 4}" rx="12" ry="7.5" fill="${c2}"/>`;
  const arms = `<ellipse cx="${leftEdge + 3}" cy="${g.cy + 8}" rx="8" ry="11" fill="${c2}" transform="rotate(20 ${leftEdge + 3} ${g.cy + 8})"/><ellipse cx="${rightEdge - 3}" cy="${g.cy + 8}" rx="8" ry="11" fill="${c2}" transform="rotate(-20 ${rightEdge - 3} ${g.cy + 8})"/>`;
  const shadow = `<ellipse cx="${CX}" cy="${bottom + 6}" rx="${g.halfW * 0.78}" ry="9" fill="#000" opacity="0.07"/>`;
  const sparkles = `<g fill="#fff8e0" opacity="0.9"><path d="M 36 56 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z"/><path d="M 166 64 l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z"/></g>`;

  const gid = `g${(spec.seed % 100000).toString(36)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
<defs>
<radialGradient id="${gid}" cx="38%" cy="28%" r="82%">
<stop offset="0%" stop-color="${c1}"/>
<stop offset="100%" stop-color="${c2}"/>
</radialGradient>
</defs>
${shadow}
${sparkles}
${tail}
${feet}
${arms}
${ears}
${hair}
<path d="${body}" fill="url(#${gid})"/>
<path d="${body}" fill="none" stroke="${c2}" stroke-width="2" opacity="0.45"/>
${belly}
${cheeks}
${eyes}
${mouth}
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
