import { createFileRoute } from "@tanstack/react-router";
import { BUILD_ID } from "@/lib/build-info";

/**
 * 稼働中デプロイのビルドIDを返す軽量エンドポイント。
 * SSRサーバーは常に最新デプロイで動くため、ここは必ず「最新のビルドID」を返す。
 * クライアント（端末にキャッシュされた古いバンドルを含む）はこれと自分の
 * 埋め込みIDを比較し、違えば自動リロードして最新UIを取得する。
 *
 * 端末やWKWebView（TestFlight/Safari）にキャッシュされないよう no-store で返す。
 */
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ buildId: BUILD_ID }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
            pragma: "no-cache",
          },
        });
      },
    },
  },
});
