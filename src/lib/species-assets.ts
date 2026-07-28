/**
 * Monomon Version 1 公式デザインアセット。
 *
 * 各種族の「代表イラスト」を透過PNGとしてCDN配信で管理します。
 * 背景を持たないため、ホーム・図鑑・オンボーディング・プレースホルダー等
 * どの画面でも「そこにその子が立っている」ように自然に置けます。
 * 個体（ユーザーの写真から生まれた子）は従来通り MonomonArt の
 * 手続き的SVGで描かれます。
 */

import battery from "@/assets/monomon/battery.png.asset.json";
import book from "@/assets/monomon/book.png.asset.json";
import bottle from "@/assets/monomon/bottle.png.asset.json";
import cactus from "@/assets/monomon/cactus.png.asset.json";
import clock from "@/assets/monomon/clock.png.asset.json";
import cup from "@/assets/monomon/cup.png.asset.json";
import cushion from "@/assets/monomon/cushion.png.asset.json";
import eraser from "@/assets/monomon/eraser.png.asset.json";
import flower from "@/assets/monomon/flower.png.asset.json";
import kettle from "@/assets/monomon/kettle.png.asset.json";
import lamp from "@/assets/monomon/lamp.png.asset.json";
import mug from "@/assets/monomon/mug.png.asset.json";
import mushroom from "@/assets/monomon/mushroom.png.asset.json";
import onigiri from "@/assets/monomon/onigiri.png.asset.json";
import pencil from "@/assets/monomon/pencil.png.asset.json";
import plant from "@/assets/monomon/plant.png.asset.json";
import pot from "@/assets/monomon/pot.png.asset.json";
import pudding from "@/assets/monomon/pudding.png.asset.json";
import scissors from "@/assets/monomon/scissors.png.asset.json";
import shoe from "@/assets/monomon/shoe.png.asset.json";
import spoon from "@/assets/monomon/spoon.png.asset.json";
import tissue from "@/assets/monomon/tissue.png.asset.json";

/** speciesId → 公式イラストのCDN URL（透過PNG） */
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
