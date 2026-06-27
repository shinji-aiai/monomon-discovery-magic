/**
 * 種族（Species）レジストリ。
 *
 * モノモンは無限に存在しますが、種族にはルールがあります。
 * 各種族は「撮影した物そのものが生き物になった」シルエットの描画ルールを持ち、
 * シルエットだけで元の物が分かることを目指します（耳を付けただけ、は禁止）。
 *
 * この配列に追加していくだけで種族を増やせます（目標：100種以上）。
 * 描画は手続き的なSVGですが、将来 AI 画像生成に差し替えても
 * 種族ルール（ID・名前・分類・色相ヒント）はそのまま活用できます。
 */

import type { Family, Palette } from "./monomon-data";

/* 描画キャンバスは viewBox 0 0 200 200、中心 x=100、地面 y≈178。 */

export interface DrawArgs {
  rng: () => number;
  p: Palette;
  /** ボディ用グラデーション参照（例: "url(#g123)"） */
  fill: string;
}

export interface SpeciesArt {
  /** ボディの後ろに描く要素（葉・湯気など） */
  back?: string;
  /** ボディ本体（シルエット） */
  body: string;
  /** ボディの前に描く要素（持ち手・文字盤など） */
  front?: string;
  /** 顔の配置 */
  face: { cx: number; cy: number; spread: number; size: number };
  /** アクセサリーを置く頭頂 */
  headTop: { x: number; y: number };
  /** 足を描く基準 */
  bottom: { y: number; halfW: number };
  /** 既定の足を描くか（既定 true） */
  feet?: boolean;
  /** 既定の腕を描くか（既定 true） */
  arms?: boolean;
}

export interface Species {
  id: string;
  /** 表示名（例：コップ族） */
  name: string;
  emoji: string;
  family: Family;
  /** 個体の色相の寄せ先（任意・0-360）。なければ写真の色を尊重。 */
  hueHint?: number;
  draw: (a: DrawArgs) => SpeciesArt;
}

/* ===================== 描画ヘルパー ===================== */

const CX = 100;

function rr(x: number, y: number, w: number, h: number, r: number): string {
  return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

function leaf(x: number, y: number, dx: number, dy: number, color: string): string {
  return `<path d="M ${x} ${y} q ${dx * 0.2} ${dy * 0.7} ${dx} ${dy} q ${-dx * 0.45} ${dy * 0.18} ${-dx} ${-dy * 0.2} q ${-dx * 0.18} ${-dy * 0.55} 0 ${-dy * 0.8} Z" fill="${color}"/>`;
}

function stroke(p: Palette, w = 2.5) {
  return `stroke="${p.line}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
}

const sheen = `<path d="M 70 78 q -10 18 4 34" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.45"/>`;

/* ===================== 種族の描画ルール ===================== */

/** コップ族 — テーパーしたタンブラー */
function drawCup(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const tw = 42, bw = 34, topY = 74, botY = 162;
  const body = `<path d="M ${CX - tw} ${topY} L ${CX + tw} ${topY} L ${CX + bw} ${botY - 12} Q ${CX + bw} ${botY} ${CX + bw - 12} ${botY} L ${CX - bw + 12} ${botY} Q ${CX - bw} ${botY} ${CX - bw} ${botY - 12} Z" fill="${fill}" ${stroke(p)}/>`;
  const front = `<ellipse cx="${CX}" cy="${topY}" rx="${tw}" ry="8" fill="${p.c1}" ${stroke(p, 2)}/>${sheen}`;
  return { body, front, face: { cx: CX, cy: 118, spread: 17, size: 12 }, headTop: { x: CX, y: topY - 8 }, bottom: { y: botY, halfW: bw } };
}

/** マグ族 — コップ＋持ち手 */
function drawMug(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const hw = 40, topY = 80, botY = 160;
  const body = `<path d="${rr(CX - hw, topY, hw * 2, botY - topY, 16)}" fill="${fill}" ${stroke(p)}/>`;
  const handle = `<path d="M ${CX + hw - 2} ${topY + 18} q 30 2 30 28 q 0 26 -30 28" fill="none" stroke="${p.c3}" stroke-width="10" stroke-linecap="round"/>`;
  const front = `<ellipse cx="${CX}" cy="${topY}" rx="${hw}" ry="8" fill="${p.c1}" ${stroke(p, 2)}/>${sheen}`;
  return { back: handle, body, front, face: { cx: CX - 4, cy: 118, spread: 16, size: 12 }, headTop: { x: CX, y: topY - 4 }, bottom: { y: botY, halfW: hw } };
}

/** ボトル族 — 胴・肩・首・キャップ */
function drawBottle(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const bw = 32, topBody = 94, botY = 164;
  const body = `<path d="M ${CX - 11} 60 L ${CX + 11} 60 L ${CX + 12} 84 Q ${CX + bw} 92 ${CX + bw} ${topBody + 4} L ${CX + bw} ${botY - 14} Q ${CX + bw} ${botY} ${CX + bw - 14} ${botY} L ${CX - bw + 14} ${botY} Q ${CX - bw} ${botY} ${CX - bw} ${botY - 14} L ${CX - bw} ${topBody + 4} Q ${CX - bw} 92 ${CX - 12} 84 Z" fill="${fill}" ${stroke(p)}/>`;
  const cap = `<path d="${rr(CX - 14, 46, 28, 16, 5)}" fill="${p.c3}" ${stroke(p, 2)}/>`;
  return { body, front: cap, face: { cx: CX, cy: 128, spread: 16, size: 12 }, headTop: { x: CX, y: 46 }, bottom: { y: botY, halfW: bw } };
}

/** ナベ族 — 横長の胴＋両側の持ち手（持ち手が耳） */
function drawPot(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const hw = 50, topY = 98, botY = 158;
  const body = `<path d="M ${CX - hw} ${topY} L ${CX + hw} ${topY} L ${CX + hw - 6} ${botY - 8} Q ${CX + hw - 10} ${botY} ${CX + hw - 22} ${botY} L ${CX - hw + 22} ${botY} Q ${CX - hw + 10} ${botY} ${CX - hw + 6} ${botY - 8} Z" fill="${fill}" ${stroke(p)}/>`;
  const rim = `<path d="${rr(CX - hw - 4, topY - 9, (hw + 4) * 2, 14, 6)}" fill="${p.c1}" ${stroke(p, 2)}/>`;
  const ears = `<path d="M ${CX - hw - 2} ${topY + 10} q -16 0 -16 12 q 0 12 16 12" fill="none" stroke="${p.c3}" stroke-width="8" stroke-linecap="round"/><path d="M ${CX + hw + 2} ${topY + 10} q 16 0 16 12 q 0 12 -16 12" fill="none" stroke="${p.c3}" stroke-width="8" stroke-linecap="round"/>`;
  return { back: ears, body, front: rim, face: { cx: CX, cy: 126, spread: 18, size: 12 }, headTop: { x: CX, y: topY - 9 }, bottom: { y: botY, halfW: hw - 14 } };
}

/** ケトル族 — 丸い胴＋注ぎ口＋取っ手 */
function drawKettle(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const r = 44, cy = 122;
  const body = `<circle cx="${CX}" cy="${cy}" r="${r}" fill="${fill}" ${stroke(p)}/>`;
  const spout = `<path d="M ${CX - r + 6} ${cy - 6} q -26 -4 -30 -26 q 10 -2 18 6 q 8 8 16 12 Z" fill="${p.c3}" ${stroke(p, 2)}/>`;
  const handle = `<path d="M ${CX - 22} ${cy - r + 4} q 22 -34 44 0" fill="none" stroke="${p.c3}" stroke-width="8" stroke-linecap="round"/>`;
  const knob = `<circle cx="${CX}" cy="${cy - r - 2}" r="6" fill="${p.c3}" ${stroke(p, 2)}/>`;
  return { back: spout + handle, body, front: knob, face: { cx: CX + 4, cy: cy + 6, spread: 16, size: 12 }, headTop: { x: CX, y: cy - r - 8 }, bottom: { y: cy + r, halfW: r - 10 } };
}

/** スプーン族 — 丸いすくい部分（顔）＋柄 */
function drawSpoon(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const cy = 92, rx = 38, ry = 32;
  const handle = `<path d="${rr(CX - 9, cy + ry - 6, 18, 80, 9)}" fill="${fill}" ${stroke(p)}/>`;
  const head = `<ellipse cx="${CX}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${stroke(p)}/><ellipse cx="${CX}" cy="${cy}" rx="${rx - 8}" ry="${ry - 8}" fill="none" stroke="${p.c3}" stroke-width="2" opacity="0.5"/>`;
  return { body: handle + head, face: { cx: CX, cy: cy + 2, spread: 14, size: 11 }, headTop: { x: CX, y: cy - ry }, bottom: { y: 168, halfW: 12 }, feet: false };
}

/** ホン族 — 立った本（背表紙＋ページ） */
function drawBook(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const hw = 42, topY = 80, botY = 162;
  const body = `<path d="${rr(CX - hw, topY, hw * 2, botY - topY, 10)}" fill="${fill}" ${stroke(p)}/>`;
  const spine = `<path d="${rr(CX - hw, topY, 14, botY - topY, 10)}" fill="${p.c3}"/>`;
  const pages = `<path d="M ${CX + hw + 1} ${topY + 6} v ${botY - topY - 12}" stroke="#fffdf6" stroke-width="6" stroke-linecap="round"/><path d="M ${CX + hw + 1} ${topY + 6} v ${botY - topY - 12}" stroke="${p.line}" stroke-width="6" stroke-linecap="round" opacity="0.18"/>`;
  const label = `<path d="${rr(CX - 8, topY + 16, 40, 22, 5)}" fill="#fffdf6" ${stroke(p, 1.6)}/>`;
  return { body, front: spine + pages + label, face: { cx: CX + 6, cy: 120, spread: 16, size: 11 }, headTop: { x: CX, y: topY }, bottom: { y: botY, halfW: hw } };
}

/** エンピツ族 — 先のとがった縦長 */
function drawPencil(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const hw = 21, topY = 86, botY = 158;
  const body = `<path d="${rr(CX - hw, topY, hw * 2, botY - topY, 6)}" fill="${fill}" ${stroke(p)}/>`;
  const wood = `<path d="M ${CX - hw} ${topY + 2} L ${CX} 52 L ${CX + hw} ${topY + 2} Z" fill="#f0d29a" ${stroke(p, 2)}/>`;
  const lead = `<path d="M ${CX - 7} 64 L ${CX} 52 L ${CX + 7} 64 Z" fill="${p.line}"/>`;
  const ferrule = `<path d="${rr(CX - hw, botY - 8, hw * 2, 16, 4)}" fill="${p.c3}" ${stroke(p, 2)}/>`;
  return { body, back: wood + lead, front: ferrule, face: { cx: CX, cy: 120, spread: 12, size: 9 }, headTop: { x: CX, y: 52 }, bottom: { y: botY + 8, halfW: hw } };
}

/** ハサミ族 — 上に伸びる2枚の刃（耳）＋下の持ち手リング */
function drawScissors(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const pivot = 118;
  const blades = `<path d="M ${CX} ${pivot} L ${CX - 7} 56 Q ${CX - 1} 50 ${CX + 3} 58 Z" fill="${p.c1}" ${stroke(p, 2)}/><path d="M ${CX} ${pivot} L ${CX + 7} 56 Q ${CX + 1} 50 ${CX - 3} 58 Z" fill="${p.c1}" ${stroke(p, 2)}/>`;
  const bodyc = `<circle cx="${CX}" cy="${pivot}" r="26" fill="${fill}" ${stroke(p)}/>`;
  const screw = `<circle cx="${CX}" cy="${pivot}" r="4" fill="${p.c3}"/>`;
  const rings = `<circle cx="${CX - 20}" cy="156" r="13" fill="none" stroke="${p.c3}" stroke-width="7"/><circle cx="${CX + 20}" cy="156" r="13" fill="none" stroke="${p.c3}" stroke-width="7"/>`;
  return { back: blades, body: bodyc, front: screw + rings, face: { cx: CX, cy: pivot - 2, spread: 11, size: 9 }, headTop: { x: CX, y: 52 }, bottom: { y: 156, halfW: 22 }, feet: false };
}

/** ケシゴム族 — 角丸ブロック＋紙スリーブ */
function drawEraser(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const hw = 44, topY = 92, botY = 160;
  const body = `<path d="${rr(CX - hw, topY, hw * 2, botY - topY, 14)}" fill="${fill}" ${stroke(p)}/>`;
  const sleeve = `<path d="${rr(CX - hw, 128, hw * 2, 22, 4)}" fill="#fffdf6" opacity="0.92"/><path d="M ${CX - hw} 134 H ${CX + hw}" stroke="${p.c3}" stroke-width="4"/>`;
  return { body, front: sleeve, face: { cx: CX, cy: 112, spread: 17, size: 12 }, headTop: { x: CX, y: topY }, bottom: { y: botY, halfW: hw } };
}

/** ショクブツ族 — 鉢＋伸びる葉っぱ（葉が髪） */
function drawPlant(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const top = 128, bot = 166;
  const pot = `<path d="M ${CX - 34} ${top} L ${CX + 34} ${top} L ${CX + 27} ${bot} L ${CX - 27} ${bot} Z" fill="${fill}" ${stroke(p)}/>`;
  const rim = `<path d="${rr(CX - 38, top - 9, 76, 13, 5)}" fill="${p.c1}" ${stroke(p, 2)}/>`;
  const g = "#73c98e", g2 = "#92d9a6";
  const foliage = leaf(CX, top - 4, -26, -54, g) + leaf(CX, top - 4, 26, -54, g2) + leaf(CX, top - 6, -6, -66, g) + leaf(CX, top - 6, 14, -58, g2);
  return { back: foliage, body: pot, front: rim, face: { cx: CX, cy: 146, spread: 14, size: 10 }, headTop: { x: CX, y: top - 60 }, bottom: { y: bot, halfW: 24 }, feet: false };
}

/** ハナ族 — 花びらに囲まれた顔＋くき */
function drawFlower(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const cy = 92, R = 30;
  let petals = "";
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 - Math.PI / 2;
    const px = CX + Math.cos(ang) * R, py = cy + Math.sin(ang) * R;
    petals += `<ellipse cx="${px}" cy="${py}" rx="15" ry="11" transform="rotate(${(ang * 180) / Math.PI + 90} ${px} ${py})" fill="${p.c1}" ${stroke(p, 2)}/>`;
  }
  const center = `<circle cx="${CX}" cy="${cy}" r="${R - 4}" fill="${fill}" ${stroke(p)}/>`;
  const stem = `<path d="M ${CX} ${cy + R} q 4 30 0 50" fill="none" stroke="#73c98e" stroke-width="7" stroke-linecap="round"/>` + leaf(CX, cy + R + 26, 24, 16, "#92d9a6");
  return { back: petals + stem, body: center, face: { cx: CX, cy, spread: 13, size: 10 }, headTop: { x: CX, y: cy - R - 8 }, bottom: { y: 170, halfW: 10 }, feet: false };
}

/** サボテン族 — 丸みのある縦長＋うで＋鉢 */
function drawCactus(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const top = 70, bodyBot = 150;
  const body = `<path d="${rr(CX - 26, top, 52, bodyBot - top, 26)}" fill="${fill}" ${stroke(p)}/>`;
  const arms = `<path d="M ${CX - 26} 104 q -18 0 -18 -16 q 0 -10 8 -10 q 8 0 8 10 v 16 Z" fill="${fill}" ${stroke(p, 2)}/><path d="M ${CX + 26} 112 q 18 0 18 -16 q 0 -10 -8 -10 q -8 0 -8 10 v 16 Z" fill="${fill}" ${stroke(p, 2)}/>`;
  const pot = `<path d="M ${CX - 30} ${bodyBot - 2} L ${CX + 30} ${bodyBot - 2} L ${CX + 24} 168 L ${CX - 24} 168 Z" fill="#e0a878" ${stroke(p)}/>`;
  return { back: arms, body, front: pot, face: { cx: CX, cy: 108, spread: 13, size: 10 }, headTop: { x: CX, y: top }, bottom: { y: 168, halfW: 22 }, feet: false };
}

/** クツ族 — 横向きスニーカー */
function drawShoe(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const upper = `<path d="M 52 150 Q 48 112 78 110 Q 96 108 104 128 Q 110 142 150 144 Q 158 145 158 152 L 52 152 Z" fill="${fill}" ${stroke(p)}/>`;
  const sole = `<path d="M 46 150 L 158 150 Q 164 150 164 158 Q 164 166 154 166 L 56 166 Q 44 166 46 150 Z" fill="#fffdf6" ${stroke(p)}/>`;
  const toe = `<path d="M 120 144 Q 150 145 152 152" fill="none" stroke="${p.c3}" stroke-width="3"/>`;
  const laces = `<path d="M 74 122 l 16 6 M 76 132 l 16 6" stroke="${p.c3}" stroke-width="3" stroke-linecap="round"/>`;
  return { body: upper + sole, front: toe + laces, face: { cx: 80, cy: 130, spread: 12, size: 10 }, headTop: { x: 78, y: 108 }, bottom: { y: 166, halfW: 0 }, feet: false };
}

/** クッション族 — ふっくら座ぶとん＋角のタッセル */
function drawCushion(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const L = 50, T = 80, R = 150, B = 162;
  const body = `<path d="M ${L} ${T + 8} Q ${L} ${T} ${L + 10} ${T} L ${R - 10} ${T} Q ${R} ${T} ${R} ${T + 8} Q ${R + 6} ${(T + B) / 2} ${R} ${B - 8} Q ${R} ${B} ${R - 10} ${B} L ${L + 10} ${B} Q ${L} ${B} ${L} ${B - 8} Q ${L - 6} ${(T + B) / 2} ${L} ${T + 8} Z" fill="${fill}" ${stroke(p)}/>`;
  const tuft = `<circle cx="${CX}" cy="${(T + B) / 2}" r="4" fill="${p.c3}"/>`;
  const tass = [[L - 2, T + 4], [R + 2, T + 4], [L - 2, B - 4], [R + 2, B - 4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${p.c3}"/>`).join("");
  return { body, front: tuft + tass, face: { cx: CX, cy: 116, spread: 18, size: 12 }, headTop: { x: CX, y: T }, bottom: { y: B, halfW: 44 } };
}

/** トケイ族 — 丸い目ざまし時計（文字盤がお腹）＋上のベル */
function drawClock(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const cy = 116, r = 48;
  const body = `<circle cx="${CX}" cy="${cy}" r="${r}" fill="${fill}" ${stroke(p)}/>`;
  const bells = `<circle cx="${CX - 30}" cy="${cy - r - 4}" r="11" fill="${p.c3}" ${stroke(p, 2)}/><circle cx="${CX + 30}" cy="${cy - r - 4}" r="11" fill="${p.c3}" ${stroke(p, 2)}/><path d="M ${CX - 14} ${cy - r + 2} q 14 -16 28 0" fill="none" stroke="${p.c3}" stroke-width="5" stroke-linecap="round"/>`;
  const bcy = cy + 18, br = 22;
  let ticks = "";
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2;
    ticks += `<circle cx="${CX + Math.cos(ang) * (br - 3)}" cy="${bcy + Math.sin(ang) * (br - 3)}" r="1.3" fill="${p.line}"/>`;
  }
  const dial = `<circle cx="${CX}" cy="${bcy}" r="${br}" fill="#fffdf6" ${stroke(p, 2)}/>${ticks}<line x1="${CX}" y1="${bcy}" x2="${CX}" y2="${bcy - 12}" stroke="${p.line}" stroke-width="2.4" stroke-linecap="round"/><line x1="${CX}" y1="${bcy}" x2="${CX + 9}" y2="${bcy}" stroke="${p.line}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${CX}" cy="${bcy}" r="2" fill="${p.line}"/>`;
  return { back: bells, body, front: dial, face: { cx: CX, cy: cy - 14, spread: 14, size: 10 }, headTop: { x: CX, y: cy - r - 14 }, bottom: { y: cy + r, halfW: r - 12 } };
}

/** ランプ族 — 台形のシェード＋首＋丸い台 */
function drawLamp(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const tH = 22, bH = 46, top = 80, bot = 128;
  const shade = `<path d="M ${CX - tH} ${top} L ${CX + tH} ${top} L ${CX + bH} ${bot} L ${CX - bH} ${bot} Z" fill="${fill}" ${stroke(p)}/>`;
  const cap = `<path d="${rr(CX - tH - 2, top - 7, (tH + 2) * 2, 11, 5)}" fill="${p.c1}" ${stroke(p, 2)}/>`;
  const neck = `<rect x="${CX - 4}" y="${bot}" width="8" height="26" fill="${p.c3}"/>`;
  const base = `<ellipse cx="${CX}" cy="160" rx="34" ry="11" fill="${p.c3}" ${stroke(p, 2)}/>`;
  const glow = `<path d="M ${CX - bH + 4} ${bot} L ${CX + bH - 4} ${bot} L ${CX + bH + 6} ${bot + 12} L ${CX - bH - 6} ${bot + 12} Z" fill="#fff3c0" opacity="0.5"/>`;
  return { back: glow, body: shade, front: cap + neck + base, face: { cx: CX, cy: 110, spread: 14, size: 10 }, headTop: { x: CX, y: top - 7 }, bottom: { y: 162, halfW: 0 }, feet: false };
}

/** デンチ族 — 縦の円筒＋＋端子 */
function drawBattery(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const hw = 28, topY = 76, botY = 162;
  const body = `<path d="${rr(CX - hw, topY, hw * 2, botY - topY, 10)}" fill="${fill}" ${stroke(p)}/>`;
  const nub = `<path d="${rr(CX - 10, topY - 8, 20, 10, 3)}" fill="${p.c3}" ${stroke(p, 2)}/>`;
  const band = `<path d="${rr(CX - hw, 96, hw * 2, 30, 4)}" fill="${p.c3}" opacity="0.85"/><text x="${CX}" y="116" text-anchor="middle" font-size="18" font-weight="800" fill="#fffdf6">＋</text>`;
  return { body, front: nub + band, face: { cx: CX, cy: 142, spread: 13, size: 10 }, headTop: { x: CX, y: topY - 8 }, bottom: { y: botY, halfW: hw } };
}

/** ティッシュ族 — 箱＋飛び出すティッシュ（ティッシュが髪） */
function drawTissue(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const hw = 48, topY = 112, botY = 166;
  const body = `<path d="${rr(CX - hw, topY, hw * 2, botY - topY, 12)}" fill="${fill}" ${stroke(p)}/>`;
  const oval = `<ellipse cx="${CX}" cy="${topY}" rx="26" ry="7" fill="${p.c3}"/>`;
  const tiss = `<path d="M ${CX - 16} ${topY} q -6 -30 12 -30 q 6 -12 12 0 q 18 0 12 30 Z" fill="#fffdf6" ${stroke(p, 1.6)}/>`;
  return { back: tiss, body, front: oval, face: { cx: CX, cy: 142, spread: 17, size: 11 }, headTop: { x: CX, y: topY - 28 }, bottom: { y: botY, halfW: hw } };
}

/** オニギリ族 — 丸みのある三角＋のり */
function drawOnigiri(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const body = `<path d="M ${CX} 64 Q ${CX + 14} 66 ${CX + 54} 146 Q ${CX + 58} 156 ${CX + 46} 156 L ${CX - 46} 156 Q ${CX - 58} 156 ${CX - 54} 146 Q ${CX - 14} 66 ${CX} 64 Z" fill="${fill}" ${stroke(p)}/>`;
  const nori = `<path d="M ${CX - 30} 134 L ${CX + 30} 134 L ${CX + 32} 156 L ${CX - 32} 156 Z" fill="#3a4a3f" ${stroke(p, 2)}/>`;
  return { body, front: nori, face: { cx: CX, cy: 112, spread: 16, size: 12 }, headTop: { x: CX, y: 66 }, bottom: { y: 156, halfW: 40 } };
}

/** プリン族 — 台形のカスタード＋カラメル */
function drawPudding(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const tw = 32, bw = 48, top = 92, bot = 156;
  const body = `<path d="M ${CX - tw} ${top + 6} Q ${CX - tw} ${top} ${CX - tw + 8} ${top} L ${CX + tw - 8} ${top} Q ${CX + tw} ${top} ${CX + tw} ${top + 6} L ${CX + bw} ${bot - 10} Q ${CX + bw} ${bot} ${CX + bw - 12} ${bot} L ${CX - bw + 12} ${bot} Q ${CX - bw} ${bot} ${CX - bw} ${bot - 10} Z" fill="${fill}" ${stroke(p)}/>`;
  const caramel = `<path d="M ${CX - tw} ${top + 4} Q ${CX} ${top - 6} ${CX + tw} ${top + 4} Q ${CX + tw - 6} ${top + 18} ${CX + 8} ${top + 14} Q ${CX - tw + 4} ${top + 24} ${CX - tw} ${top + 4} Z" fill="#b9783f" ${stroke(p, 2)}/>`;
  return { body, front: caramel, face: { cx: CX, cy: 124, spread: 16, size: 12 }, headTop: { x: CX, y: top - 4 }, bottom: { y: bot, halfW: bw } };
}

/** キノコ族 — かさ（模様）＋じく（顔） */
function drawMushroom(a: DrawArgs): SpeciesArt {
  const { p, fill } = a;
  const capCy = 96, capR = 50;
  const stem = `<path d="M ${CX - 24} 116 Q ${CX - 26} 162 ${CX - 16} 164 L ${CX + 16} 164 Q ${CX + 26} 162 ${CX + 24} 116 Z" fill="#fff4e6" ${stroke(p)}/>`;
  const cap = `<path d="M ${CX - capR} ${capCy + 18} Q ${CX - capR} ${capCy - 40} ${CX} ${capCy - 40} Q ${CX + capR} ${capCy - 40} ${CX + capR} ${capCy + 18} Z" fill="${fill}" ${stroke(p)}/>`;
  const spots = `<circle cx="${CX - 22}" cy="${capCy - 6}" r="7" fill="#fffdf6"/><circle cx="${CX + 18}" cy="${capCy - 14}" r="6" fill="#fffdf6"/><circle cx="${CX + 8}" cy="${capCy + 6}" r="5" fill="#fffdf6"/>`;
  return { body: stem, back: cap + spots, face: { cx: CX, cy: 138, spread: 13, size: 10 }, headTop: { x: CX, y: capCy - 40 }, bottom: { y: 164, halfW: 20 } };
}

/* ===================== レジストリ ===================== */

export const SPECIES: Species[] = [
  { id: "cup", name: "コップ族", emoji: "🥛", family: "drink", draw: drawCup },
  { id: "mug", name: "マグ族", emoji: "☕", family: "drink", draw: drawMug },
  { id: "bottle", name: "ボトル族", emoji: "🍶", family: "drink", draw: drawBottle },
  { id: "pot", name: "ナベ族", emoji: "🍲", family: "kitchen", draw: drawPot },
  { id: "kettle", name: "ケトル族", emoji: "🫖", family: "kitchen", draw: drawKettle },
  { id: "spoon", name: "スプーン族", emoji: "🥄", family: "kitchen", draw: drawSpoon },
  { id: "book", name: "ホン族", emoji: "📕", family: "stationery", draw: drawBook },
  { id: "pencil", name: "エンピツ族", emoji: "✏️", family: "stationery", hueHint: 45, draw: drawPencil },
  { id: "scissors", name: "ハサミ族", emoji: "✂️", family: "stationery", draw: drawScissors },
  { id: "eraser", name: "ケシゴム族", emoji: "🧽", family: "stationery", draw: drawEraser },
  { id: "plant", name: "ショクブツ族", emoji: "🪴", family: "plant", hueHint: 130, draw: drawPlant },
  { id: "flower", name: "ハナ族", emoji: "🌸", family: "plant", draw: drawFlower },
  { id: "cactus", name: "サボテン族", emoji: "🌵", family: "plant", hueHint: 120, draw: drawCactus },
  { id: "shoe", name: "クツ族", emoji: "👟", family: "wear", draw: drawShoe },
  { id: "cushion", name: "クッション族", emoji: "🛋️", family: "wear", draw: drawCushion },
  { id: "clock", name: "トケイ族", emoji: "⏰", family: "device", draw: drawClock },
  { id: "lamp", name: "ランプ族", emoji: "💡", family: "device", draw: drawLamp },
  { id: "battery", name: "デンチ族", emoji: "🔋", family: "device", draw: drawBattery },
  { id: "tissue", name: "ティッシュ族", emoji: "🧻", family: "paper", draw: drawTissue },
  { id: "onigiri", name: "オニギリ族", emoji: "🍙", family: "food", draw: drawOnigiri },
  { id: "pudding", name: "プリン族", emoji: "🍮", family: "food", hueHint: 42, draw: drawPudding },
  { id: "mushroom", name: "キノコ族", emoji: "🍄", family: "food", hueHint: 8, draw: drawMushroom },
];

export const SPECIES_MAP: Record<string, Species> = Object.fromEntries(
  SPECIES.map((s) => [s.id, s]),
);

/** 種族の総数（図鑑の進捗表示などに使用） */
export const SPECIES_COUNT = SPECIES.length;

export function getSpecies(id: string): Species {
  return SPECIES_MAP[id] ?? SPECIES[0];
}

/** 家族（大分類）ごとの種族IDプール */
const FAMILY_POOL: Record<Family, string[]> = (() => {
  const map = {} as Record<Family, string[]>;
  for (const s of SPECIES) (map[s.family] ??= []).push(s.id);
  return map;
})();

/** 写真の分析結果から、宿りやすい家族を選びます。 */
function pickFamily(
  a: { hue: number; saturation: number; lightness: number; aspect: number },
  rng: () => number,
): Family {
  const { hue, saturation, aspect } = a;
  const r = rng();
  // 縦に細長い → 文具・みどり寄り
  if (aspect < 0.7 && r < 0.5) return r < 0.25 ? "stationery" : "plant";
  // 無彩色（彩度が低い）→ でんき・かみ・ぶんぐ
  if (saturation < 0.16) return r < 0.45 ? "device" : r < 0.78 ? "paper" : "stationery";
  // みどり
  if (hue >= 80 && hue < 175) return r < 0.7 ? "plant" : "food";
  // 青〜紫
  if (hue >= 175 && hue < 260) return r < 0.6 ? "drink" : "device";
  if (hue >= 260 && hue < 320) return r < 0.55 ? "wear" : "drink";
  // あたたかい色 → たべもの・だいどころ・のみもの
  return r < 0.42 ? "food" : r < 0.72 ? "kitchen" : "drink";
}

/** 写真から、宿る種族を1つ決めます（家族 → 家族内でランダム）。 */
export function detectSpecies(
  a: { hue: number; saturation: number; lightness: number; aspect: number },
  rng: () => number,
): Species {
  const fam = pickFamily(a, rng);
  const pool = FAMILY_POOL[fam];
  const id = pool[Math.floor(rng() * pool.length)];
  return SPECIES_MAP[id];
}
