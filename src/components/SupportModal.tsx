import { useState } from "react";
import { toast } from "sonner";
import { Heart, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createSupportCheckout,
  SUPPORT_AMOUNTS,
} from "@/lib/support.functions";
import { tap, playSound, haptic } from "@/lib/sound";

interface SupportModalProps {
  onClose: () => void;
}

/** 「モノモンを応援する」モーダル。Stripe Checkout に接続できる構造。 */
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
        window.location.href = res.url;
        return;
      }
      // Stripe 未接続のときも、気持ちはしっかり受け取る
      playSound("save");
      haptic([12, 40, 12]);
      toast.success("応援ありがとうございます！", {
        description: "決済の受付は準備中です。お気持ち、しかと受け取りました。",
      });
      onClose();
    } catch {
      toast.error("うまく開けませんでした。もう一度おためしください。");
    } finally {
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
          いつもありがとうございます。
        </p>
      </div>
    </div>
  );
}
