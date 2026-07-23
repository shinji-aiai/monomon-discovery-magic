// Phase 1E — Reusable stored-immersion visual.
// Reads the saved IndexedDB image via useImmersionImageUrl and renders it as a
// blurred cover backdrop + object-contain foreground. Falls back to the supplied
// procedural SVG fallback whenever the stored image is unavailable.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useImmersionImageUrl } from "@/hooks/use-immersion-image-url";
import type { Monomon } from "@/lib/monomon";
import { cn } from "@/lib/utils";

interface StoredImmersionVisualProps {
  monomon: Monomon;
  fallback: ReactNode;
  alt?: string;
  className?: string;
  /** If true, wait until near viewport before loading (album thumbnails). */
  lazy?: boolean;
}

export function StoredImmersionVisual({
  monomon,
  fallback,
  alt,
  className,
  lazy,
}: StoredImmersionVisualProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState<boolean>(!lazy);

  useEffect(() => {
    if (!lazy) return;
    if (inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, inView]);

  const { url, available } = useImmersionImageUrl(monomon.immersionImageId, {
    enabled: inView,
  });

  return (
    <div ref={ref} className={cn("relative h-full w-full overflow-hidden", className)}>
      {available && url ? (
        <>
          <img
            src={url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-[10px] brightness-95"
          />
          <img
            src={url}
            alt={alt ?? ""}
            className="relative h-full w-full object-contain"
          />
        </>
      ) : (
        fallback
      )}
    </div>
  );
}
