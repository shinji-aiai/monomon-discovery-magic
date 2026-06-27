import {
  CATEGORIES,
  DESCRIPTIONS,
  NAME_POOLS,
  PERSONALITIES,
  type Category,
} from "./monomon-data";

export interface Monomon {
  id: string;
  name: string;
  category: Category;
  personality: string;
  description: string;
  /** ISO日時。発見日。 */
  discoveredAt: string;
  /** 元になった写真（縮小したdata URL） */
  photo: string;
  /** イラスト再生成用のシード */
  seed: number;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 写真から「モノモン」を生成します。
 *
 * ⚠️ 現在はモック実装（写真から決定的にキャラクターを生成）です。
 *    将来 OpenAI の画像生成APIなどに接続する場合は、この関数の
 *    中身だけを差し替えてください。呼び出し側・表示側は変更不要です。
 *
 * 例:
 *   const monomon = await generateMonomon(photoDataUrl);
 *
 * 本物のAPIに差し替える際のイメージ:
 *   const res = await fetch("/api/generate-monomon", {
 *     method: "POST", body: JSON.stringify({ image }),
 *   });
 *   return await res.json();
 */
export async function generateMonomon(photo: string): Promise<Monomon> {
  // 解析演出に合わせて少し待つ（実APIの体感に近づける）
  await new Promise((r) => setTimeout(r, 250));

  // 写真の内容 + 少しの時刻ゆらぎから seed を作る
  const base = hashString(photo.slice(0, 2048));
  const seed = (base ^ Math.floor(Date.now() / 1000)) >>> 0;
  const rng = rngFrom(seed);

  const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
  const names = NAME_POOLS[category];
  const name = names[Math.floor(rng() * names.length)];
  const personality = PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)];
  const description = DESCRIPTIONS[Math.floor(rng() * DESCRIPTIONS.length)];

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mm_${seed}_${Date.now()}`,
    name,
    category,
    personality,
    description,
    discoveredAt: new Date().toISOString(),
    photo,
    seed,
  };
}

export function formatDiscoveredDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return "";
  }
}
