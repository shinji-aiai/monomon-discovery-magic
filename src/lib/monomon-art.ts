import { CATEGORY_STYLES, type Category } from "./monomon-data";

/**
 * モノモンの「かわいいイラスト」をSVGで手続き的に生成します。
 * 同じ seed なら必ず同じ姿になります（再現性あり）。
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

type Pt = { x: number; y: number };

function blobPath(rng: () => number, cx: number, cy: number, r: number): string {
  const count = 10;
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 - Math.PI / 2;
    const jitter = r * (0.86 + rng() * 0.24);
    // 少し下ぶくれ（座った印象）
    const stretch = 1 + Math.sin(ang) * 0.06;
    pts.push({
      x: cx + Math.cos(ang) * jitter,
      y: cy + Math.sin(ang) * jitter * stretch,
    });
  }
  const p = (i: number) => pts[(i + count) % count];
  let d = `M ${p(0).x.toFixed(1)} ${p(0).y.toFixed(1)} `;
  for (let i = 0; i < count; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }
  return d + "Z";
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function renderMonomonSVG(seed: number, category: Category): string {
  const rng = mulberry32(seed);
  const style = CATEGORY_STYLES[category];
  const [c1, c2] = style.body;
  const cheek = style.cheek;

  const cx = 100;
  const cy = 112;
  const r = 58;
  const body = blobPath(rng, cx, cy, r);

  const eyeType = pick(rng, ["round", "round", "sparkle", "sleepy", "wink"]);
  const mouthType = pick(rng, ["smile", "smile", "cat", "o", "open"]);
  const accessory = pick(rng, ["antenna", "sprout", "ahoge", "none", "none"]);

  const eyeY = cy - 6;
  const lx = cx - 21;
  const rx = cx + 21;
  const er = 11;

  const drawEye = (x: number, closed = false) => {
    if (eyeType === "sleepy" || closed) {
      return `<path d="M ${x - 9} ${eyeY} Q ${x} ${eyeY - 9} ${x + 9} ${eyeY}" fill="none" stroke="#4a3b32" stroke-width="3.4" stroke-linecap="round"/>`;
    }
    let inner = "";
    if (eyeType === "sparkle") {
      inner = `<circle cx="${x - 3}" cy="${eyeY - 3.5}" r="3.4" fill="#fff"/><circle cx="${x + 3.5}" cy="${eyeY + 3}" r="1.6" fill="#fff" opacity="0.85"/>`;
    } else {
      inner = `<circle cx="${x - 3}" cy="${eyeY - 3.5}" r="3.2" fill="#fff"/>`;
    }
    return `<ellipse cx="${x}" cy="${eyeY}" rx="${er * 0.82}" ry="${er}" fill="#4a3b32"/>${inner}`;
  };

  const leftEye = drawEye(lx, eyeType === "wink");
  const rightEye = drawEye(rx);

  let mouth = "";
  const my = cy + 14;
  if (mouthType === "smile") {
    mouth = `<path d="M ${cx - 9} ${my} Q ${cx} ${my + 9} ${cx + 9} ${my}" fill="none" stroke="#4a3b32" stroke-width="3" stroke-linecap="round"/>`;
  } else if (mouthType === "cat") {
    mouth = `<path d="M ${cx - 10} ${my} Q ${cx - 5} ${my + 6} ${cx} ${my} Q ${cx + 5} ${my + 6} ${cx + 10} ${my}" fill="none" stroke="#4a3b32" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (mouthType === "o") {
    mouth = `<circle cx="${cx}" cy="${my + 2}" r="4.5" fill="#4a3b32"/>`;
  } else {
    mouth = `<path d="M ${cx - 8} ${my - 2} Q ${cx} ${my + 10} ${cx + 8} ${my - 2} Z" fill="#e8607a"/>`;
  }

  const cheeks = `<ellipse cx="${cx - 30}" cy="${cy + 6}" rx="8" ry="5.5" fill="${cheek}" opacity="0.55"/><ellipse cx="${cx + 30}" cy="${cy + 6}" rx="8" ry="5.5" fill="${cheek}" opacity="0.55"/>`;

  let top = "";
  if (accessory === "antenna") {
    top = `<line x1="${cx}" y1="${cy - r + 4}" x2="${cx + 4}" y2="${cy - r - 18}" stroke="#9a8472" stroke-width="3" stroke-linecap="round"/><circle cx="${cx + 5}" cy="${cy - r - 21}" r="6" fill="${cheek}"/>`;
  } else if (accessory === "sprout") {
    top = `<path d="M ${cx} ${cy - r + 2} q -16 -6 -18 -22 q 16 -2 18 16" fill="#8fd6a6"/><path d="M ${cx} ${cy - r + 2} q 14 -8 18 -20 q -14 -4 -18 14" fill="#a8e6c0"/>`;
  } else if (accessory === "ahoge") {
    top = `<path d="M ${cx} ${cy - r + 4} q -6 -16 8 -22 q -2 12 -8 22" fill="none" stroke="#9a8472" stroke-width="3.5" stroke-linecap="round"/>`;
  }

  // 小さな手足
  const feet = `<ellipse cx="${cx - 20}" cy="${cy + r - 6}" rx="11" ry="7" fill="${c2}"/><ellipse cx="${cx + 20}" cy="${cy + r - 6}" rx="11" ry="7" fill="${c2}"/>`;
  const arms = `<ellipse cx="${cx - r + 4}" cy="${cy + 12}" rx="8" ry="11" fill="${c2}" transform="rotate(18 ${cx - r + 4} ${cy + 12})"/><ellipse cx="${cx + r - 4}" cy="${cy + 12}" rx="8" ry="11" fill="${c2}" transform="rotate(-18 ${cx + r - 4} ${cy + 12})"/>`;

  // ふわふわ星
  const sparkles = `<g fill="#fff8e0" opacity="0.9"><path d="M 40 50 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z"/><path d="M 162 62 l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z"/></g>`;

  const gid = `g${seed % 100000}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs>
<radialGradient id="${gid}" cx="38%" cy="30%" r="80%">
<stop offset="0%" stop-color="${c1}"/>
<stop offset="100%" stop-color="${c2}"/>
</radialGradient>
</defs>
<ellipse cx="${cx}" cy="${cy + r + 2}" rx="${r * 0.8}" ry="9" fill="#000" opacity="0.07"/>
${sparkles}
${feet}
${arms}
${top}
<path d="${body}" fill="url(#${gid})"/>
<path d="${body}" fill="none" stroke="${c2}" stroke-width="2" opacity="0.4"/>
${cheeks}
${leftEye}
${rightEye}
${mouth}
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
