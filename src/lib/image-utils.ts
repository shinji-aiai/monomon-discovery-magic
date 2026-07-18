/** 画像ユーティリティ：撮影/選択した写真を縮小・分析して扱います。 */

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 長辺を max px に縮小し、JPEG の data URL を返します（保存サイズ削減）。 */
export async function downscaleDataUrl(
  dataUrl: string,
  max = 720,
  quality = 0.82,
): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

export interface PhotoAnalysis {
  /** 平均色相 0-360 */
  hue: number;
  /** 平均彩度 0-1 */
  saturation: number;
  /** 平均明度 0-1 */
  lightness: number;
  /** 縦横比（幅/高さ） */
  aspect: number;
  /** 色のばらつき（0-1, 大きいほど賑やか） */
  busy: number;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

/**
 * 写真を小さく描き、平均色・彩度・明度・縦横比・賑やかさを取り出します。
 * これを使って「撮ったモノ」に合わせたモノモンを生成します。
 */
export async function analyzePhoto(dataUrl: string): Promise<PhotoAnalysis> {
  const fallback: PhotoAnalysis = {
    hue: 40,
    saturation: 0.4,
    lightness: 0.6,
    aspect: 1,
    busy: 0.3,
  };
  try {
    const img = await loadImage(dataUrl);
    const aspect = img.width / Math.max(1, img.height);
    const size = 28;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ...fallback, aspect };
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // 平均色（彩度で重み付け：背景の灰色より「モノの色」を優先）
    let wsum = 0;
    let hx = 0;
    let hy = 0;
    let satSum = 0;
    let lightSum = 0;
    let n = 0;
    const lights: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      const w = 0.15 + s; // 彩度が高いほど重視
      const a = (h * Math.PI) / 180;
      hx += Math.cos(a) * w;
      hy += Math.sin(a) * w;
      wsum += w;
      satSum += s;
      lightSum += l;
      lights.push(l);
      n++;
    }
    let hue = (Math.atan2(hy, hx) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const saturation = satSum / n;
    const lightness = lightSum / n;
    const meanL = lightness;
    const variance =
      lights.reduce((acc, l) => acc + (l - meanL) ** 2, 0) / n;
    const busy = Math.min(1, Math.sqrt(variance) * 3.2);
    return { hue, saturation, lightness, aspect, busy };
  } catch {
    return fallback;
  }
}
