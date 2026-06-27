import { useMemo } from "react";
import { renderMonomonSVG } from "@/lib/monomon-art";
import { specOf, type Monomon } from "@/lib/monomon";
import { buildSpec, type Category } from "@/lib/monomon-data";
import { cn } from "@/lib/utils";

interface MonomonArtProps {
  /** 完全なモノモン（推奨：体型・特徴・表情を反映） */
  monomon?: Monomon;
  /** 簡易表示用（ホームの装飾など） */
  seed?: number;
  category?: Category;
  className?: string;
}

/** モノモンのイラストを表示します。 */
export function MonomonArt({ monomon, seed, category, className }: MonomonArtProps) {
  const svg = useMemo(() => {
    const spec = monomon
      ? specOf(monomon)
      : buildSpec(seed ?? 1, category ?? "ふしぎ種");
    return renderMonomonSVG(spec);
  }, [monomon, seed, category]);
  return (
    <div
      className={cn("h-full w-full select-none", className)}
      // SVGは内部生成（信頼済み）のため安全
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-hidden
    />
  );
}
