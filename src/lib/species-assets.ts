/**
 * Monomon Version 1 公式デザインアセット。
 *
 * 各種族の「代表イラスト」を CDN 配信の静的画像として管理します。
 * ここに載っているのは "種族の顔"（図鑑・ホーム・プレースホルダー等の
 * 静的表示専用）で、ユーザーが撮影して生まれた個体の見た目には触れません。
 * 個体は従来通り MonomonArt の手続き的 SVG で描かれます。
 */

import battery from "@/assets/monomon/battery.jpg.asset.json";
import book from "@/assets/monomon/book.jpg.asset.json";
import bottle from "@/assets/monomon/bottle.jpg.asset.json";
import cactus from "@/assets/monomon/cactus.jpg.asset.json";
import clock from "@/assets/monomon/clock.jpg.asset.json";
import cup from "@/assets/monomon/cup.jpg.asset.json";
import cushion from "@/assets/monomon/cushion.jpg.asset.json";
import eraser from "@/assets/monomon/eraser.jpg.asset.json";
import flower from "@/assets/monomon/flower.jpg.asset.json";
import kettle from "@/assets/monomon/kettle.jpg.asset.json";
import lamp from "@/assets/monomon/lamp.jpg.asset.json";
import mug from "@/assets/monomon/mug.jpg.asset.json";
import mushroom from "@/assets/monomon/mushroom.jpg.asset.json";
import onigiri from "@/assets/monomon/onigiri.jpg.asset.json";
import pencil from "@/assets/monomon/pencil.jpg.asset.json";
import plant from "@/assets/monomon/plant.jpg.asset.json";
import pot from "@/assets/monomon/pot.jpg.asset.json";
import pudding from "@/assets/monomon/pudding.jpg.asset.json";
import scissors from "@/assets/monomon/scissors.jpg.asset.json";
import shoe from "@/assets/monomon/shoe.jpg.asset.json";
import spoon from "@/assets/monomon/spoon.jpg.asset.json";
import tissue from "@/assets/monomon/tissue.jpg.asset.json";

/** speciesId → 公式イラストのCDN URL */
export const SPECIES_OFFICIAL_ART: Record<string, string> = {
  battery: battery.url,
  book: book.url,
  bottle: bottle.url,
  cactus: cactus.url,
  clock: clock.url,
  cup: cup.url,
  cushion: cushion.url,
  eraser: eraser.url,
  flower: flower.url,
  kettle: kettle.url,
  lamp: lamp.url,
  mug: mug.url,
  mushroom: mushroom.url,
  onigiri: onigiri.url,
  pencil: pencil.url,
  plant: plant.url,
  pot: pot.url,
  pudding: pudding.url,
  scissors: scissors.url,
  shoe: shoe.url,
  spoon: spoon.url,
  tissue: tissue.url,
};

/** 種族の公式イラストURLを取得（未定義なら undefined を返す） */
export function getOfficialArt(speciesId: string): string | undefined {
  return SPECIES_OFFICIAL_ART[speciesId];
}
