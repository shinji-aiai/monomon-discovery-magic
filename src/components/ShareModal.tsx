import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Download, Share2, Loader2 } from "lucide-react";
import type { Monomon } from "@/lib/monomon";
import { renderCardImage, saveImageBlob } from "@/lib/card-image";
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
    } catch (err) {
      console.error("[monomon] 画像保存に失敗:", err);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[oklch(0.12_0.05_275_/_0.7)] backdrop-blur-md sm:items-center">
      <div className="relative w-full max-w-md animate-rise-in overflow-hidden rounded-t-[32px] glass-night p-6 pb-8 shadow-purple-glow sm:rounded-[32px]">
        {/* 星のような粒 */}
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute rounded-full bg-white/60 animate-twinkle"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 80}%`,
              width: 2 + (i % 2),
              height: 2 + (i % 2),
              opacity: 0.5,
              animationDelay: `${(i % 5) * 0.4}s`,
            }}
          />
        ))}

        <div className="relative mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">シェア</h2>
          <button
            onClick={() => {
              tap();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 active:scale-95"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* シェアカード：夜の展示台に載せる */}
        <div className="relative mx-auto mb-7 w-56">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-4 rounded-[28px] bg-purple-300/30 blur-2xl"
          />
          <div className="relative overflow-hidden rounded-[22px] border border-white/20 shadow-purple-glow">
            {preview ? (
              <img src={preview} alt={`${monomon.name}のシェアカード`} className="w-full" />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center bg-white/5">
                <Loader2 className="h-6 w-6 animate-spin text-white/60" />
              </div>
            )}
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/20 to-transparent" />
          </div>
          {/* 台座の反射 */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-3 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-full bg-white/25 blur-md"
          />
        </div>

        <div className="relative grid grid-cols-3 gap-3">
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

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={saveImage}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/12 py-3 text-sm font-bold text-white backdrop-blur active:scale-95"
          >
            <Download className="h-4 w-4" />
            画像を保存
          </button>
          <button
            onClick={systemShare}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-float active:scale-95 disabled:opacity-60"
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
        className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-purple-glow"
        style={{ backgroundColor: color, color: textColor }}
      >
        {children}
      </span>
      <span className="text-xs font-medium text-white/70">{label}</span>
    </button>
  );
}

