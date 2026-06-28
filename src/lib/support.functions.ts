import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * 「モノモンを応援する」決済の構造。
 *
 * いまは Stripe を未接続でも安全に動くよう設計しています。
 * STRIPE_SECRET_KEY を設定すると、自動的に Stripe Checkout に接続されます。
 * 金額は下の SUPPORT_AMOUNTS を変えるだけで後から自由に変更できます。
 *
 * 接続手順（将来）：
 *   1. Stripe のシークレットキーをシークレットに登録（STRIPE_SECRET_KEY）
 *   2. それだけで本関数が Checkout セッションURLを返すようになります
 */

/** 応援金額（円）。後からここを編集するだけで変更できます。 */
export const SUPPORT_AMOUNTS = [120, 370, 800] as const;

export type SupportResult =
  | { status: "redirect"; url: string }
  | { status: "not_configured" };

export const createSupportCheckout = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        amount: z.number().int().min(100).max(50000),
        origin: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<SupportResult> => {
    const key = process.env.STRIPE_SECRET_KEY;
    // 未接続ならフロント側で「準備中」を案内する
    if (!key) return { status: "not_configured" };

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${data.origin}/?support=thanks`);
    params.set("cancel_url", `${data.origin}/settings`);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "jpy");
    params.set("line_items[0][price_data][unit_amount]", String(data.amount));
    params.set(
      "line_items[0][price_data][product_data][name]",
      "モノモンを応援する",
    );
    params.set(
      "line_items[0][price_data][product_data][description]",
      "新しいモノモンの開発に使わせていただきます。",
    );

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe checkout failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { url?: string };
    if (!json.url) throw new Error("Stripe checkout: missing url");
    return { status: "redirect", url: json.url };
  });
