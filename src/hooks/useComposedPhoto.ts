import { useEffect, useState } from "react";
import { getComposedPhoto } from "@/lib/photo-storage";

/**
 * Monomon に紐づく合成写真（IndexedDB Blob）を Object URL として購読します。
 *
 * hasComposed が false のときは null を返し、呼び出し側は元写真にフォールバック。
 * アンマウント時に URL を revoke してメモリを解放します。
 */
export function useComposedPhoto(
  monomonId: string,
  hasComposed: boolean | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;

    if (!hasComposed) {
      setUrl(null);
      return;
    }

    (async () => {
      const blob = await getComposedPhoto(monomonId);
      if (!alive) return;
      if (!blob) {
        setUrl(null);
        return;
      }
      created = URL.createObjectURL(blob);
      setUrl(created);
    })();

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [monomonId, hasComposed]);

  return url;
}
