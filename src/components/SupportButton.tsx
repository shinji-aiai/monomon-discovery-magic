import { useState } from "react";
import { Heart, ChevronRight } from "lucide-react";
import { SupportModal } from "@/components/SupportModal";
import { tap } from "@/lib/sound";

type Variant = "home" | "result";

interface SupportButtonProps {
  variant: Variant;
}

/**
 * 「モノモンを応援する」への入口。
 * 押すと SupportModal を開き、金額選択後に Stripe Checkout へ遷移する。
 * 配置：ホーム下部（card）と 発見結果画面（inline）。
 */
export function SupportButton({ variant }: SupportButtonProps) {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    tap();
    setOpen(true);
  };

  return (
    <>
      {variant === "home" ? (
        <button
          onClick={handleOpen}
          className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-card/80 px-4 py-3 text-left shadow-soft backdrop-blur active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
            <Heart className="h-5 w-5 fill-rose-400 text-rose-400" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-foreground">
              ❤️ モノモンを応援する
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              新しいモノモンの開発に使わせていただきます。
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className="mt-4 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground active:scale-95"
        >
          <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
          この子が気に入ったら応援する
        </button>
      )}

      {open && <SupportModal onClose={() => setOpen(false)} />}
    </>
  );
}
