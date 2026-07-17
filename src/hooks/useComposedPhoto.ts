import { useEffect, useState } from "react";
import { getComposedPhotoRef } from "@/lib/photo-storage";

/**
 * Monomon に紐づく合成写真を、耐久ストレージから引いて <img> に渡せるURLとして返す。
 *
 * 由来（IDB / localStorage）に応じた URL を返し、blob: URL の場合はアンマウント時に
 * revoke してメモリを解放する。data: URL の場合は revoke しない。
 */
export function useComposedPhoto(
  monomonId: string,
  hasComposed: boolean | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let revoke: (() => void) | null = null;

    if (!hasComposed) {
      setUrl(null);
      return;
    }

    (async () => {
      const ref = await getComposedPhotoRef(monomonId);
      if (!alive) {
        ref?.revoke?.();
        return;
      }
      if (!ref) {
        setUrl(null);
        return;
      }
      revoke = ref.revoke ?? null;
      setUrl(ref.url);
    })();

    return () => {
      alive = false;
      if (revoke) revoke();
    };
  }, [monomonId, hasComposed]);

  return url;
}
