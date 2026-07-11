/**
 * このデプロイに一意なビルドID。
 *
 * vite.config.ts の `define` によって、クライアントのバンドルとSSRサーバーの
 * 両方に「同じビルド時の値」が埋め込まれる。公開のたびに値が変わるため、
 * 端末にキャッシュされた古いクライアントが、稼働中の最新デプロイを検知して
 * 自動で最新UIに更新できる（src/components/AutoUpdater.tsx を参照）。
 */
declare const __BUILD_ID__: string;

export const BUILD_ID: string =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
