import { Capacitor } from "@capacitor/core";
import { FAMILY_STYLES } from "./monomon-data";
import { getSpecies } from "./species";
import { renderMonomonSVG, svgToDataUrl } from "./monomon-art";
import { formatDiscoveredDate, specOf, type Monomon } from "./monomon";
import { getImmersionImage } from "./immersion-image-store";

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
 * 写真をうっすら背景に敷き、モノモンが飛び出す上質な構図にします。
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

  const fam = FAMILY_STYLES[monomon.family];
  const species = getSpecies(monomon.speciesId);
  const accent = monomon.palette.c3;
  const mat = fam;
  const style = { cheek: accent };

  // 背景（素材グラデ）
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, mat.bg[0]);
  bg.addColorStop(1, mat.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 内側カード
  const m = 56;
  const cardX = m;
  const cardY = m;
  const cardW = W - m * 2;
  const cardH = H - m * 2;
  ctx.save();
  ctx.shadowColor = "rgba(90,60,40,0.18)";
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#fffdf8";
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fill();
  ctx.restore();

  const cx = W / 2;
  const brown = "#4a3b32";
  const muted = "#9a8472";
  ctx.textAlign = "center";

  let y = cardY + 74;
  ctx.fillStyle = muted;
  ctx.font = "700 32px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText("モノモン", cx, y);

  if (variant === "share") {
    y += 50;
    ctx.fillStyle = style.cheek;
    ctx.font = "800 42px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillText("モノモンを見つけた！", cx, y);
  }

  // ===== イラストパネル（写真をうっすら背景に）=====
  const panelX = cardX + 44;
  const panelY = y + 36;
  const panelW = cardW - 88;
  const panelH = 560;

  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, 40);
  ctx.clip();

  // 元写真（ぼかして薄く）
  try {
    const photo = await loadImage(monomon.photo);
    ctx.save();
    ctx.filter = "blur(10px)";
    drawCover(ctx, photo, panelX - 20, panelY - 20, panelW + 40, panelH + 40);
    ctx.restore();
  } catch {
    /* 写真がなくても続行 */
  }

  // 素材グラデのティント
  const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  pg.addColorStop(0, mat.bg[0] + "ee");
  pg.addColorStop(1, mat.bg[1] + "ee");
  ctx.fillStyle = pg;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // 中心グロー
  const glow = ctx.createRadialGradient(
    cx,
    panelY + panelH * 0.46,
    20,
    cx,
    panelY + panelH * 0.46,
    panelW * 0.5,
  );
  glow.addColorStop(0, style.cheek + "44");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // 上部の光沢
  const sheen = ctx.createLinearGradient(0, panelY, 0, panelY + 120);
  sheen.addColorStop(0, "rgba(255,255,255,0.5)");
  sheen.addColorStop(1, "transparent");
  ctx.fillStyle = sheen;
  ctx.fillRect(panelX, panelY, panelW, 120);
  ctx.restore();

  // チップ
  ctx.font = "700 26px 'M PLUS Rounded 1c', sans-serif";
  const chip = (text: string, dx: number, align: "left" | "right") => {
    const padX = 22;
    const tw = ctx.measureText(text).width;
    const cw = tw + padX * 2;
    const bx = align === "left" ? panelX + 22 : panelX + panelW - 22 - cw;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    roundRect(ctx, bx, panelY + 22, cw, 46, 23);
    ctx.fill();
    ctx.fillStyle = brown;
    ctx.textAlign = "left";
    ctx.fillText(text, bx + padX, panelY + 22 + 32);
    ctx.textAlign = "center";
  };
  chip(`${species.emoji} ${species.name}`, 0, "left");
  chip(`${fam.emoji} ${fam.label}族`, 0, "right");

  // モノモン本体（飛び出す）
  const svg = renderMonomonSVG(specOf(monomon));
  const sizedSvg = svg.replace(
    /width="100%" height="100%"/,
    'width="420" height="420"',
  );
  const art = await loadImage(svgToDataUrl(sizedSvg));
  const artSize = 420;
  ctx.drawImage(art, cx - artSize / 2, panelY + panelH - artSize + 36, artSize, artSize);

  // ===== テキスト =====
  y = panelY + panelH + 78;
  ctx.fillStyle = brown;
  ctx.font = "800 72px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText(monomon.name, cx, y);

  // 性格チップ
  y += 56;
  ctx.font = "700 30px 'M PLUS Rounded 1c', sans-serif";
  const perText = monomon.personality;
  const pw = ctx.measureText(perText).width + 48;
  ctx.fillStyle = style.cheek;
  roundRect(ctx, cx - pw / 2, y - 34, pw, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(perText, cx, y + 2);

  // 説明
  y += 80;
  ctx.fillStyle = brown;
  ctx.font = "500 38px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText("「" + monomon.description + "」", cx, y);

  // 発見日
  ctx.fillStyle = muted;
  ctx.font = "500 28px 'M PLUS Rounded 1c', sans-serif";
  ctx.fillText(
    "発見日  " + formatDiscoveredDate(monomon.discoveredAt),
    cx,
    cardY + cardH - 44,
  );

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png", 0.95),
  );
}

/** 保存結果。native では Photos、web ではダウンロード。 */
export type SaveResult = "photos" | "download";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = typeof reader.result === "string" ? reader.result : "";
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * ネイティブ端末の「写真」アプリへ保存する（権限が無ければ確認が出る）。
 *
 * `@capacitor-community/media` の savePhoto は base64 データURLを直接受け取れる
 * ため、Filesystem への書き出し→読み込み→削除という壊れやすい往復を挟まず、
 * 生成した PNG をそのまま渡す。iOS 14+ で albumIdentifier を省略すると
 * NSPhotoLibraryAddUsageDescription に基づく「追加のみ」の権限確認が出る。
 */
async function saveBlobToPhotos(blob: Blob): Promise<void> {
  const { Media } = await import("@capacitor-community/media");
  const base64 = await blobToBase64(blob);
  await Media.savePhoto({ path: `data:image/png;base64,${base64}` });
}

/** web 向け：ブラウザのダウンロードで保存する。 */
function downloadBlob(blob: Blob, fileBase: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 生成済みの画像 Blob を保存する（native=写真アプリ / web=ダウンロード）。 */
export async function saveImageBlob(
  blob: Blob,
  fileBase: string,
): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    await saveBlobToPhotos(blob);
    return "photos";
  }
  downloadBlob(blob, fileBase);
  return "download";
}

/** モノモンのカード画像を生成して保存する。 */
export async function saveCardImage(
  monomon: Monomon,
  variant: "save" | "share" = "save",
): Promise<SaveResult> {
  const blob = await renderCardImage(monomon, variant);
  return saveImageBlob(blob, `monomon-${monomon.name}`);
}

