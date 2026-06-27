import { useMemo } from "react";
import { renderMonomonSVG } from "@/lib/monomon-art";
import type { Category } from "@/lib/monomon-data";
import { cn } from "@/lib/utils";

interface MonomonArtProps {
  seed: number;
  category: Category;
  className?: string;
}

/** モノモンのイラストを表示します。 */
export function MonomonArt({ seed, category, className }: MonomonArtProps) {
  const svg = useMemo(() => renderMonomonSVG(seed, category), [seed, category]);
  return (
    <div
      className={cn("h-full w-full select-none", className)}
      // SVGは内部生成（信頼済み）のため安全
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-hidden
    />
  );
}
