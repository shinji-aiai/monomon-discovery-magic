import { useState } from "react";
import { toast } from "sonner";
import { Heart, X, Loader2 } from "lucide-react";
import {
  SUPPORT_OPTIONS,
  createSupportCheckout,
} from "@/lib/support.functions";
import { isPaymentsConfigured, getStripeEnvironment } from "@/lib/stripe";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { tap } from "@/lib/sound";

interface SupportModalProps {
  onClose: () => void;
}

/**
 * 「モノモンを応援する」モーダル。
 * 金額を選んで「応援する」を押すと、その場で Stripe の安全な決済画面を表示します。
 * 決済が完了したときだけ、Stripe が成功ページ（/checkout/return）へ案内します。
 * 途中でやめたいときは閉じれば元の画面に戻ります（成功表示は出ません）。
 */
export function SupportModal({ onClose }: SupportModalProps) {
  const [option, setOption] =
    useState<(typeof SUPPORT_OPTIONS)[number]>(SUPPORT_OPTIONS[1]);
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const startPayment = async () => {
    tap();
    if (!isPaymentsConfigured()) {
      toast.error("ただいま応援を受け付けられません。", {
        description: "公開後にもう一度おためしください。",
      });
      return;
    }

    setPaying(true);
    setLoading(true);
    try {
      const result = await createSupportCheckout({
        data: {
          priceId: option.priceId,
          returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result || !result.clientSecret) {
        throw new Error("error" in result ? result.error : "no client secret");
      }
      setClientSecret(result.clientSecret);
    } catch {
      toast.error("ただいま応援を受け付けられません。", {
        description: "時間をおいて、もう一度おためしください。",
      });
      setPaying(false);
    } finally {
      setLoading(false);
    }
  };

  const resetSelection = () => {
    tap();
    setPaying(false);
    setClientSecret(null);
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

        {paying ? (
          <div className="mt-2">
            <p className="mb-4 text-center text-sm text-muted-foreground">
              ¥{option.amount} の応援
            </p>
            <StripeEmbeddedCheckout
              priceId={option.priceId}
              returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
            <button
              onClick={() => {
                tap();
                setPaying(false);
              }}
              className="mt-4 w-full rounded-full bg-muted py-3 text-sm font-bold text-muted-foreground active:scale-95"
            >
              金額をえらび直す
            </button>
          </div>
        ) : (
          <>
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
              {SUPPORT_OPTIONS.map((o) => {
                const active = o.priceId === option.priceId;
                return (
                  <button
                    key={o.priceId}
                    onClick={() => {
                      tap();
                      setOption(o);
                    }}
                    className={`rounded-2xl py-4 text-center font-extrabold transition-all active:scale-95 ${
                      active
                        ? "gradient-primary text-primary-foreground shadow-soft"
                        : "bg-card text-foreground shadow-soft"
                    }`}
                  >
                    <span className="text-lg">¥{o.amount}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={startPayment}
              disabled={paying}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full gradient-primary py-4 text-lg font-extrabold text-primary-foreground shadow-float transition-transform active:scale-95 disabled:opacity-70"
            >
              {paying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Heart className="h-5 w-5 fill-current" />
              )}
              ¥{option.amount} で応援する
            </button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              決済は Stripe の安全な画面で行われます。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
