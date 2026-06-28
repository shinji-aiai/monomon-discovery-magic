import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";

interface StripeEmbeddedCheckoutProps {
  /** 事前に作成済みの Checkout Session の client secret。 */
  clientSecret: string;
}

/**
 * 取得済みの clientSecret を使って Stripe の埋め込み決済を表示する。
 * セッション作成（および失敗時のメッセージ表示）は呼び出し側で行うため、
 * Stripe 標準の「Something went wrong」画面は出さない。
 */
export function StripeEmbeddedCheckout({
  clientSecret,
}: StripeEmbeddedCheckoutProps) {
  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
