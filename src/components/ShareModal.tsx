import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Download, Share2, Loader2 } from "lucide-react";
import type { Monomon } from "@/lib/monomon";
import { renderCardImage } from "@/lib/card-image";
import { tap, playSound } from "@/lib/sound";

interface ShareModalProps {
  monomon: Monomon;
  onClose: () => void;
}

const APP_URL =
  typeof window !== "undefined" ? window.location.origin : "https://monomon.app";

export function ShareModal({ monomon, onClose }: ShareModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const shareText = `モノモンを見つけた！「${monomon.name}」— ${monomon.description} #モノモン`;

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    renderCardImage(monomon, "share").then((b) => {
      if (!active) return;
      setBlob(b);
      url = URL.createObjectURL(b);
      setPreview(url);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [monomon]);

  const saveImage = async () => {
    tap();
    try {
      const b = blob ?? (await renderCardImage(monomon, "share"));
      const where = await saveImageBlob(b, `monomon-${monomon.name}`);
      playSound("save");
      toast.success(
        where === "photos" ? "写真アプリに保存しました📸" : "画像を保存しました",
      );
    } catch {
      toast.error("うまく保存できなかったよ　もう一度ためしてみてね");
    }
  };

  const systemShare = async () => {
    tap();
    setBusy(true);
    try {
      const b = blob ?? (await renderCardImage(monomon, "share"));
      const file = new File([b], `monomon-${monomon.name}.png`, {
        type: "image/png",
      });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
      };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: shareText, title: "モノモン" });
      } else if (navigator.share) {
        await navigator.share({ text: shareText, url: APP_URL, title: "モノモン" });
      } else {
        await saveImage();
        toast("画像を保存したよ　お好きなアプリで共有できる");
      }
    } catch {
      /* キャンセル等は無視 */
    } finally {
      setBusy(false);
    }
  };

  const shareX = () => {
    tap();
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText,
    )}&url=${encodeURIComponent(APP_URL)}`;
    window.open(u, "_blank", "noopener");
  };

  const shareLine = () => {
    tap();
    const u = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(
      APP_URL,
    )}&text=${encodeURIComponent(shareText)}`;
    window.open(u, "_blank", "noopener");
  };

  const shareInstagram = async () => {
    await saveImage();
    toast("画像を保存したよ　Instagramのストーリーに貼り付けてね");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md animate-rise-in rounded-t-3xl bg-card p-6 pb-8 shadow-float sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">シェア</h2>
          <button
            onClick={() => {
              tap();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto mb-6 w-48 overflow-hidden rounded-2xl shadow-soft">
          {preview ? (
            <img src={preview} alt={`${monomon.name}のシェアカード`} className="w-full" />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <ShareBtn label="X" onClick={shareX} color="#000000" textColor="#fff">
            <span className="text-xl font-bold">𝕏</span>
          </ShareBtn>
          <ShareBtn label="LINE" onClick={shareLine} color="#06C755" textColor="#fff">
            <span className="text-sm font-extrabold">LINE</span>
          </ShareBtn>
          <ShareBtn
            label="Instagram"
            onClick={shareInstagram}
            color="#E1306C"
            textColor="#fff"
          >
            <span className="text-base">📷</span>
          </ShareBtn>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={saveImage}
            className="flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground active:scale-95"
          >
            <Download className="h-4 w-4" />
            画像を保存
          </button>
          <button
            onClick={systemShare}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            その他で共有
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareBtn({
  label,
  onClick,
  color,
  textColor,
  children,
}: {
  label: string;
  onClick: () => void;
  color: string;
  textColor: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 active:scale-95"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-soft"
        style={{ backgroundColor: color, color: textColor }}
      >
        {children}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </button>
  );
}
