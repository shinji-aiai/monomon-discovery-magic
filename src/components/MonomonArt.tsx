import { useMemo } from "react";
import { renderMonomonSVG } from "@/lib/monomon-art";
import { specOf, specFromSeed, type Monomon } from "@/lib/monomon";
import { getOfficialArt } from "@/lib/species-assets";
import { cn } from "@/lib/utils";

interface MonomonArtProps {
  /** 完全なモノモン個体（撮影から生まれた「その子」を表示） */
  monomon?: Monomon;
  /** 簡易表示用（ホームの装飾など） */
  seed?: number;
  /** 種族を指定したいとき（任意） */
  speciesId?: string;
  className?: string;
}

/**
 * モノモンのイラストを表示します。
 *
 * 個体（monomon）が渡されたときは、その子の色・表情・アクセサリーを
 * 反映した手続き的SVGを描きます（＝ユーザーの写真から生まれた「その子」）。
 * 個体がなく seed/speciesId だけのとき（図鑑の代表・プレースホルダー等）は、
 * 種族の公式イラスト（Version 1 デザイン基準）を静的画像として表示します。
 */
export function MonomonArt({ monomon, seed, speciesId, className }: MonomonArtProps) {
  const svg = useMemo(() => {
    if (monomon) return renderMonomonSVG(specOf(monomon));
    return null;
  }, [monomon]);

  // 個体が指定されていない＝種族の顔として使う。公式イラストを優先。
  if (!monomon) {
    const targetId =
      speciesId ?? specFromSeed(seed ?? 1).speciesId;
    const officialUrl = getOfficialArt(targetId);
    if (officialUrl) {
      return (
        <img
          src={officialUrl}
          alt=""
          loading="lazy"
          width={512}
          height={512}
          className={cn(
            "h-full w-full select-none object-contain",
            className,
          )}
          aria-hidden
        />
      );
    }
    // フォールバック：公式画像が未定義なら従来のSVG
    const spec = specFromSeed(seed ?? 1, speciesId);
    return (
      <div
        className={cn("h-full w-full select-none", className)}
        dangerouslySetInnerHTML={{ __html: renderMonomonSVG(spec) }}
        aria-hidden
      />
    );
  }

  // 個体：ユーザーの写真から生まれた子は従来通りSVG（AI生成領域には触れない）
  return (
    <div
      className={cn("h-full w-full select-none", className)}
      dangerouslySetInnerHTML={{ __html: svg! }}
      aria-hidden
    />
  );
}
