import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

/**
 * Stripe Webhook。決済完了など重要イベントを受け取ります。
 * 応援は一度きりの寄付なので、ここでは決済完了を記録（ログ）するだけです。
 * サブスクリプションは扱いません。
 */
async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log(
        "応援の決済が完了しました:",
        session.id,
        session.amount_total,
        session.currency,
      );
      break;
    }
    case "checkout.session.expired":
      console.log("応援の決済が期限切れになりました:", event.data.object?.id);
      break;
    default:
      console.log("未処理のイベント:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook: 無効な env クエリ:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
