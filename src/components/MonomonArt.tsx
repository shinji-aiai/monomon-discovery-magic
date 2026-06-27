import { useMemo } from "react";
import { renderMonomonSVG } from "@/lib/monomon-art";
import { specOf, specFromSeed, type Monomon } from "@/lib/monomon";
import { cn } from "@/lib/utils";

interface MonomonArtProps {
  /** 完全なモノモン個体（推奨：種族・色・表情を反映） */
  monomon?: Monomon;
  /** 簡易表示用（ホームの装飾など） */
  seed?: number;
  /** 種族を指定したいとき（任意） */
  speciesId?: string;
  className?: string;
}

/** モノモンのイラストを表示します。 */
export function MonomonArt({ monomon, seed, speciesId, className }: MonomonArtProps) {
  const svg = useMemo(() => {
    const spec = monomon ? specOf(monomon) : specFromSeed(seed ?? 1, speciesId);
    return renderMonomonSVG(spec);
  }, [monomon, seed, speciesId]);
  return (
    <div
      className={cn("h-full w-full select-none", className)}
      // SVGは内部生成（信頼済み）のため安全
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-hidden
    />
  );
}
