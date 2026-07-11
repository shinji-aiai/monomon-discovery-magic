import { useEffect } from "react";
import { BUILD_ID } from "@/lib/build-info";

/**
 * 公開後、ユーザーが「なにもしなくても」最新UIを受け取れるようにする自動更新。
 *
 * 仕組み：
 *  - 各デプロイには一意の BUILD_ID がバンドルに埋め込まれている。
 *  - サーバー（常に最新デプロイ）の /api/public/version が最新の BUILD_ID を返す。
 *  - 端末で動いているクライアントの BUILD_ID と食い違えば、新デプロイがある証拠。
 *  - その場合、キャッシュを迂回するクエリを付けて location.replace で再読み込みし、
 *    最新のHTML→最新の（ハッシュ付き）チャンクを取得する。
 *
 * Capacitor（WKWebView は server.url で本番を読み込む）でも、Safari でも同じ経路で
 * 効くため、TestFlight の再インストールや手動キャッシュ削除は不要。
 */

const VERSION_URL = "/api/public/version";
const POLL_MS = 60_000;
const BUST_PARAM = "_v";

/** 本番（公開サイト / Capacitor）だけで動かす。エディタのプレビューや開発では動かさない。 */
function shouldRun(): boolean {
  if (typeof window === "undefined") return false;
  if (BUILD_ID === "dev") return false;
  // Lovable エディタの iframe プレビュー内では動かさない。
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false; // クロスオリジン iframe
  }
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return false;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return false;
  if (
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com")
  ) {
    return false;
  }
  return true;
}

async function fetchServerBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: unknown };
    return typeof data.buildId === "string" ? data.buildId : null;
  } catch {
    return null;
  }
}

function reloadFresh(serverId: string) {
  const url = new URL(window.location.href);
  // URL を変えることで WKWebView / Safari のHTMLキャッシュを確実に迂回する。
  url.searchParams.set(BUST_PARAM, serverId);
  window.location.replace(url.toString());
}

export function AutoUpdater() {
  useEffect(() => {
    if (!shouldRun()) return;

    // すでに最新ビルドで動いているなら、キャッシュ迂回用パラメータを掃除する。
    const current = new URL(window.location.href);
    if (current.searchParams.has(BUST_PARAM)) {
      current.searchParams.delete(BUST_PARAM);
      window.history.replaceState(null, "", current.toString());
    }

    let stopped = false;
    let reloading = false;

    const check = async () => {
      if (stopped || reloading) return;
      const serverId = await fetchServerBuildId();
      if (!serverId || stopped || reloading) return;
      if (serverId !== BUILD_ID) {
        reloading = true;
        reloadFresh(serverId);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    const interval = window.setInterval(() => void check(), POLL_MS);
    // アプリ復帰（WKWebView の resume でも発火）・フォーカス時にも確認する。
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
