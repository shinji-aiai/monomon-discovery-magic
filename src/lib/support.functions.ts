import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

/**
 * 「モノモンを応援する」決済（Stripe Embedded Checkout）。
 *
 * 応援は一度きりの寄付（one-time payment）です。サブスクリプションはありません。
 * 金額ごとに作成済みの Stripe 商品（price lookup_key）を使用します。
 * 金額を変えたいときは SUPPORT_OPTIONS と Stripe 商品を合わせて更新してください。
 */

/** 応援金額（円）と、それぞれに対応する Stripe price の lookup_key。 */
export const SUPPORT_OPTIONS = [
  { amount: 120, priceId: "support_120" },
  { amount: 370, priceId: "support_370" },
  { amount: 800, priceId: "support_800" },
] as const;

/** 互換用：金額の配列。 */
export const SUPPORT_AMOUNTS = SUPPORT_OPTIONS.map((o) => o.amount) as number[];

const VALID_PRICE_IDS = SUPPORT_OPTIONS.map((o) => o.priceId);

type CheckoutResult = { clientSecret: string } | { error: string };

export const createSupportCheckout = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        priceId: z.enum(VALID_PRICE_IDS as [string, ...string[]]),
        returnUrl: z.string().url(),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);

      // human-readable lookup_key から Stripe price を解決
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) {
        return { error: "応援メニューが見つかりませんでした。" };
      }
      const stripePrice = prices.data[0];

      // ダッシュボードで分かりやすいよう商品名を description に設定
      const productId =
        typeof stripePrice.product === "string"
          ? stripePrice.product
          : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: product.name },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
