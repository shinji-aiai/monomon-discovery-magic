import { CATEGORY_STYLES } from "./monomon-data";
import { renderMonomonSVG, svgToDataUrl } from "./monomon-art";
import { formatDiscoveredDate, type Monomon } from "./monomon";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * 保存・シェア用のカード画像（PNG Blob）を生成します。
 * variant: "save" = 図鑑カード, "share" = シェア用（見つけた！表記入り）
 */
export async function renderCardImage(
  monomon: Monomon,
  variant: "save" | "share" = "save",
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* noop */
  }

  const style = CATEGORY_STYLES[monomon.category];

  // 背景グラデ
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, style.bg[0]);
  bg.addColorStop(1, style.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 内側カード
  const m = 64;
  ctx.save();
  ctx.shadowColor = "rgba(90,60,40,0.18)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#fffdf8";
  roundRect(ctx, m, m, W - m * 2, H - m * 2, 56);
  ctx.fill();
  ctx.restore();

  const cardX = m;
  const cardW = W - m * 2;
  const cx = W / 2;
  let y = m + 80;

  const brown = "#4a3b32";
  const muted = "#9a8472";
  ctx.textAlign = "center";

  // ヘッダー
  ctx.fillStyle = muted;
  ctx.font = "700 34px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText("モノモン", cx, y);

  if (variant === "share") {
    y += 56;
    ctx.fillStyle = style.cheek;
    ctx.font = "800 44px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillText("モノモンを見つけた！", cx, y);
  }

  // モノモン本体（やわらかい円の上に）
  y += 70;
  const discR = 220;
  const discCy = y + discR;
  const disc = ctx.createRadialGradient(
    cx,
    discCy - 40,
    20,
    cx,
    discCy,
    discR,
  );
  disc.addColorStop(0, style.bg[0]);
  disc.addColorStop(1, style.bg[1]);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, discCy, discR, 0, Math.PI * 2);
  ctx.fill();

  const svg = renderMonomonSVG(monomon.seed, monomon.category);
  const art = await loadImage(svgToDataUrl(svg));
  const artSize = 340;
  ctx.drawImage(art, cx - artSize / 2, discCy - artSize / 2, artSize, artSize);

  y = discCy + discR + 70;

  // 名前
  ctx.fillStyle = brown;
  ctx.font = "800 76px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText(monomon.name, cx, y);

  // 分類 + 性格チップ
  y += 56;
  ctx.font = "700 32px 'M PLUS Rounded 1c', sans-serif";
  const chip = (text: string, color: string, bgc: string, drawX: number) => {
    const padX = 28;
    const tw = ctx.measureText(text).width;
    const cw = tw + padX * 2;
    ctx.fillStyle = bgc;
    roundRect(ctx, drawX, y - 34, cw, 56, 28);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(text, drawX + padX, y + 6);
    ctx.textAlign = "center";
    return cw;
  };
  const catText = style.emoji + " " + monomon.category;
  const perText = monomon.personality;
  ctx.font = "700 32px 'M PLUS Rounded 1c', sans-serif";
  const w1 = ctx.measureText(catText).width + 56;
  const w2 = ctx.measureText(perText).width + 56;
  const gap = 20;
  const total = w1 + w2 + gap;
  let startX = cx - total / 2;
  startX += chip(catText, brown, style.bg[1], startX) + gap;
  chip(perText, "#fff", style.cheek, startX);

  // 説明
  y += 96;
  ctx.fillStyle = brown;
  ctx.font = "500 40px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText("「" + monomon.description + "」", cx, y);

  // 元写真サムネ
  y += 60;
  const thumb = 150;
  try {
    const photo = await loadImage(monomon.photo);
    ctx.save();
    roundRect(ctx, cx - thumb / 2, y, thumb, thumb, 28);
    ctx.clip();
    drawCover(ctx, photo, cx - thumb / 2, y, thumb, thumb);
    ctx.restore();
    ctx.strokeStyle = "rgba(154,132,114,0.3)";
    ctx.lineWidth = 3;
    roundRect(ctx, cx - thumb / 2, y, thumb, thumb, 28);
    ctx.stroke();
  } catch {
    /* 写真がなくても続行 */
  }

  // 発見日 / フッター
  ctx.fillStyle = muted;
  ctx.font = "500 28px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText(
    "発見日  " + formatDiscoveredDate(monomon.discoveredAt),
    cx,
    cardX + cardW - 20 < 0 ? y : H - m - 36,
  );

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png", 0.95),
  );
}

export async function downloadCardImage(monomon: Monomon) {
  const blob = await renderCardImage(monomon, "save");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `monomon-${monomon.name}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
