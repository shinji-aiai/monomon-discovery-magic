import type { DiscoveryErrorKind } from "@/lib/monomon";

export type GentleErrorKind = "permission" | DiscoveryErrorKind;

interface GentleErrorProps {
  kind: GentleErrorKind;
  onRetry: () => void;
}

interface ErrorContent {
  title: string;
  lines: string[];
  action: string;
}

const CONTENT: Record<GentleErrorKind, ErrorContent> = {
  permission: {
    title: "カメラを使わせてね",
    lines: ["モノモンを探すために", "カメラの使用をゆるしてね"],
    action: "もう一度",
  },
  network: {
    title: "少し休憩しているみたい",
    lines: ["うまくつながらなかったみたい", "少し時間をあけて試してね"],
    action: "もう一度",
  },
  busy: {
    title: "少し休憩しているみたい",
    lines: ["たくさんの出会いでちょっと一休み", "少し時間をあけて試してね"],
    action: "もう一度",
  },
  too_far: {
    title: "もう少し近づいてね",
    lines: ["モノが小さく写っているみたい"],
    action: "もう一度撮る",
  },
  too_dark: {
    title: "明るい場所で撮ってみよう",
    lines: ["少し暗くて見えにくいみたい"],
    action: "もう一度撮る",
  },
  blurry: {
    title: "ゆっくり撮ってみよう",
    lines: ["少しぶれてしまったみたい"],
    action: "もう一度撮る",
  },
  unclear: {
    title: "今日はうまく会えなかったみたい",
    lines: ["また別のモノを撮ってみよう"],
    action: "もう一度撮る",
  },
  unknown: {
    title: "今日はうまく会えなかったみたい",
    lines: ["また別のモノを撮ってみよう"],
    action: "もう一度撮る",
  },
};

/** 絵本のような静かな案内。アイコンや派手な色は使わない。 */
export function GentleError({ kind, onRetry }: GentleErrorProps) {
  const { title, lines, action } = CONTENT[kind];

  return (
    <div className="m-auto flex w-full flex-col items-center justify-center py-10 text-center">
      <p className="text-[17px] font-medium tracking-[0.04em] text-foreground/75">
        {title}
      </p>
      <p className="mt-5 max-w-xs text-[13px] font-medium leading-[2] text-foreground/50">
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </p>

      <button
        onClick={onRetry}
        className="mt-10 rounded-full bg-foreground px-8 py-4 text-[14px] font-semibold tracking-[0.12em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]"
      >
        {action}
      </button>

      {kind === "permission" && (
        <p className="mt-6 max-w-xs text-[11px] leading-[2] tracking-[0.04em] text-foreground/40">
          ブラウザのカメラ許可を見直してね
        </p>
      )}
    </div>
  );
}
