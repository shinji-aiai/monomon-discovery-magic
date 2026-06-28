// Import from the "/pure" entry so merely importing this module does NOT
// auto-inject Stripe.js (fraud-signals). The script is only loaded when
// loadStripe() is actually called (i.e. when the user opens the payment UI).
// This keeps Stripe — and its localStorage/sessionStorage access, which throws
// a SecurityError in storage-restricted in-app browsers like LINE's WKWebView —
// completely out of the home screen's initial load.
import { loadStripe, type Stripe } from "@stripe/stripe-js/pure";

// Declared locally so this client module has no cross-tree imports.
type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as
  | string
  | undefined;

// Derive environment from the token PREFIX, not its mere presence.
function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "決済はまだ設定が完了していません。公開後にもう一度おためしください。",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export function isPaymentsConfigured(): boolean {
  return (
    clientToken?.startsWith("pk_test_") === true ||
    clientToken?.startsWith("pk_live_") === true
  );
}
