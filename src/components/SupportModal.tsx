import { useState } from "react";
import { toast } from "sonner";
import { Heart, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createSupportCheckout,
  SUPPORT_AMOUNTS,
} from "@/lib/support.functions";
import { tap } from "@/lib/sound";

interface SupportModalProps {
  onClose: () => void;
}

/** 「モノモンを応援する」モーダル。押すと必ず Stripe Checkout へ遷移する。 */
export function SupportModal({ onClose }: SupportModalProps) {
  const checkout = useServerFn(createSupportCheckout);
  const [amount, setAmount] = useState<number>(SUPPORT_AMOUNTS[1]);
  const [busy, setBusy] = useState(false);

  const support = async () => {
    tap();
    setBusy(true);
    try {
      const res = await checkout({
        data: { amount, origin: window.location.origin },
      });
      if (res.status === "redirect") {
        // Stripe Checkout へ遷移
        window.location.href = res.url;
        return;
      }
      // 決済を準備できないときは、はっきりエラーを伝える（ダミー成功は出さない）
      toast.error("ただいま応援を受け付けられません。", {
        description: "時間をおいて、もう一度おためしください。",
      });
      setBusy(false);
    } catch {
      toast.error("うまく開けませんでした。もう一度おためしください。");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[88svh] w-full max-w-md animate-rise-in overflow-y-auto rounded-t-3xl bg-background p-6 pb-10 shadow-float sm:rounded-3xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground">
            モノモンを応援する
          </h2>
          <button
            onClick={() => {
              tap();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <Heart className="h-8 w-8 fill-rose-400 text-rose-400" />
          </span>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
            応援いただいた金額は、
            <br />
            新しいモノモンの開発に使わせていただきます。
          </p>
        </div>

        {/* 金額えらび */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {SUPPORT_AMOUNTS.map((a) => {
            const active = a === amount;
            return (
              <button
                key={a}
                onClick={() => {
                  tap();
                  setAmount(a);
                }}
                className={`rounded-2xl py-4 text-center font-extrabold transition-all active:scale-95 ${
                  active
                    ? "gradient-primary text-primary-foreground shadow-soft"
                    : "bg-card text-foreground shadow-soft"
                }`}
              >
                <span className="text-lg">¥{a}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={support}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full gradient-primary py-4 text-lg font-extrabold text-primary-foreground shadow-float transition-transform active:scale-95 disabled:opacity-70"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Heart className="h-5 w-5 fill-current" />
          )}
          ¥{amount} で応援する
        </button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          決済は Stripe の安全な画面で行われます。
        </p>
      </div>
    </div>
  );
}
