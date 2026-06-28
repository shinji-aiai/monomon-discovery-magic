/**
 * Google Analytics 4 (GA4) の計測ヘルパー。
 *
 * - 既存機能には一切手を加えず、計測イベントの送信だけを行います。
 * - すべてクライアント側でのみ動作し、未初期化／storage制限環境でも
 *   例外でアプリを止めないよう安全側に倒しています（LINE WebView対策）。
 */

export const GA_MEASUREMENT_ID = "G-YTWQV1BP22";

type GtagArgs = [string, ...unknown[]];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

function gtag(...args: GtagArgs) {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag(...args);
    }
  } catch {
    // 計測失敗はアプリ動作に影響させない
  }
}

/** SPA のルート遷移ごとにページビューを送信する。 */
export function trackPageView(path: string) {
  gtag("event", "page_view", {
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : path,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

/** 任意のカスタムイベントを送信する。 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  gtag("event", name, params);
}

/** 「見つける」ボタンのクリック。 */
export function trackFindClick() {
  trackEvent("find_click");
}

/** 図鑑画面を開いた回数。 */
export function trackZukanOpen() {
  trackEvent("zukan_open");
}

/** 応援ボタンのクリック。 */
export function trackSupportClick(variant: string) {
  trackEvent("support_click", { variant });
}

/** 応援完了（決済成功）。 */
export function trackSupportComplete() {
  trackEvent("support_complete");
}
