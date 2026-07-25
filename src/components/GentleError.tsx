import { Camera, Moon, RefreshCw, Search, Sun, ScanEye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DiscoveryErrorKind } from "@/lib/monomon";

/** カメラ権限OFF＋出会いの失敗をまとめてやさしく扱う種類。 */
export type GentleErrorKind = "permission" | DiscoveryErrorKind;

interface GentleErrorProps {
  kind: GentleErrorKind;
  onRetry: () => void;
  /** [DEV DEBUG] 発生した元エラー（開発時のみ画面下部に生の詳細を表示） */
  debugError?: unknown;
}

interface ErrorContent {
  icon: LucideIcon;
  title: string;
  lines: string[];
  action: string;
  actionIcon: LucideIcon;
}

const CONTENT: Record<GentleErrorKind, ErrorContent> = {
  // ① カメラ権限がOFF
  permission: {
    icon: Camera,
    title: "カメラを使わせてね",
    lines: ["モノモンを探すために", "カメラの使用をゆるしてね"],
    action: "もう一度ためす",
    actionIcon: RefreshCw,
  },
  // ③ 通信エラー
  network: {
    icon: Moon,
    title: "少し休憩しているみたい",
    lines: ["うまくつながらなかったみたい", "少し時間をあけて試してね"],
    action: "もう一度ためす",
    actionIcon: RefreshCw,
  },
  // ③ 混みあっているとき（少し待ってほしい）
  busy: {
    icon: Moon,
    title: "少し休憩しているみたい",
    lines: ["たくさんの出会いでちょっと一休み", "少し時間をあけて試してね"],
    action: "もう一度ためす",
    actionIcon: RefreshCw,
  },
  // ② 遠すぎる → 近づいてもらう
  too_far: {
    icon: ScanEye,
    title: "もう少し近づいてね",
    lines: ["モノが小さく写っているみたい", "近づいて もう一度撮ってみよう"],
    action: "もう一度撮る",
    actionIcon: Camera,
  },
  // ② 暗すぎる → 明るい場所で
  too_dark: {
    icon: Sun,
    title: "明るい場所で撮ってみよう",
    lines: ["少し暗くて見えにくいみたい", "光のある場所でもう一度ためそう"],
    action: "もう一度撮る",
    actionIcon: Camera,
  },
  // ② ぶれ → モノ全体をゆっくり
  blurry: {
    icon: ScanEye,
    title: "モノ全体が入るように撮ってね",
    lines: ["少しぶれてしまったみたい", "ゆっくり構えてもう一度ためそう"],
    action: "もう一度撮る",
    actionIcon: Camera,
  },
  // ②④ 見つけられなかった／写真がうまく見えない
  unclear: {
    icon: Search,
    title: "今日はかくれんぼ中みたい",
    lines: ["うまく見つけられなかったみたい", "もう一度撮影してみよう！"],
    action: "もう一度撮る",
    actionIcon: Camera,
  },
  // ④ そのほか（想定外）
  unknown: {
    icon: Search,
    title: "今日はかくれんぼ中みたい",
    lines: ["うまく見つけられなかったみたい", "もう一度撮影してみよう！"],
    action: "もう一度撮る",
    actionIcon: Camera,
  },
};


/** 怖いエラー画面ではなく、Monomonらしいやさしい案内を出す。 */
export function GentleError({ kind, onRetry, debugError }: GentleErrorProps) {
  const { icon: Icon, title, lines, action, actionIcon: ActionIcon } =
    CONTENT[kind];

  // [DEV DEBUG] 開発時のみ生のエラー詳細を表示（本番挙動には影響しない）
  const debugInfo = (() => {
    if (!debugError) return null;
    const e = debugError as {
      name?: string;
      message?: string;
      stack?: string;
      debug?: {
        status?: number;
        gatewayBody?: string;
        providerBody?: string;
        fetchError?: string;
        parseError?: string;
        upstreamError?: string;
        analyzeError?: string;
      };
      cause?: unknown;
    };
    return {
      name: e.name ?? typeof debugError,
      message: e.message ?? String(debugError),
      stack: e.stack,
      status: e.debug?.status,
      upstreamError: e.debug?.upstreamError,
      gatewayBody: e.debug?.gatewayBody,
      providerBody: e.debug?.providerBody,
      fetchError: e.debug?.fetchError,
      parseError: e.debug?.parseError,
      analyzeError: e.debug?.analyzeError,
      cause:
        e.cause instanceof Error
          ? `${e.cause.name}: ${e.cause.message}\n${e.cause.stack ?? ""}`
          : e.cause !== undefined
            ? String(e.cause)
            : undefined,
    };
  })();

  return (
    <div className="m-auto flex w-full flex-col items-center justify-center py-6 text-center">
      <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full gradient-magic shadow-glow animate-breathe">
        <Icon className="h-14 w-14 text-card" strokeWidth={1.6} />
      </div>

      <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </p>

      <button
        onClick={onRetry}
        className="mt-10 flex items-center justify-center gap-2.5 rounded-full gradient-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-float active:scale-95"
      >
        <ActionIcon className="h-5 w-5" />
        {action}
      </button>

      {kind === "permission" && (
        <p className="mt-6 max-w-xs text-xs leading-relaxed text-muted-foreground/70">
          <span className="block">カメラがオフのままだと探せないよ</span>
          <span className="block">
            ブロックした時は お使いのブラウザのカメラ許可を見直してね
          </span>
        </p>
      )}

      {debugInfo && (
        <details
          open
          className="mx-4 mt-8 w-full max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-left"
        >
          <summary className="cursor-pointer text-xs font-bold text-destructive">
            [DEV] Debug details (temporary)
          </summary>
          <pre className="mt-2 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-foreground">
{`kind: ${kind}
name: ${debugInfo.name}
message: ${debugInfo.message}
${debugInfo.status !== undefined ? `status: ${debugInfo.status}\n` : ""}${debugInfo.upstreamError ? `upstreamError: ${debugInfo.upstreamError}\n` : ""}${debugInfo.gatewayBody ? `\n--- gatewayBody ---\n${debugInfo.gatewayBody}\n` : ""}${debugInfo.providerBody ? `\n--- providerBody ---\n${debugInfo.providerBody}\n` : ""}${debugInfo.fetchError ? `\n--- fetchError ---\n${debugInfo.fetchError}\n` : ""}${debugInfo.parseError ? `\n--- parseError ---\n${debugInfo.parseError}\n` : ""}${debugInfo.analyzeError ? `\n--- analyzeError ---\n${debugInfo.analyzeError}\n` : ""}${debugInfo.stack ? `\n--- stack ---\n${debugInfo.stack}\n` : ""}${debugInfo.cause ? `\n--- cause ---\n${debugInfo.cause}\n` : ""}`}
          </pre>
        </details>
      )}
    </div>
  );
}
