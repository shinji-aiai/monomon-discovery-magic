import type { DiscoveryErrorKind, PipelineDiagnostic } from "@/lib/monomon";

export type GentleErrorKind = "permission" | DiscoveryErrorKind;

interface GentleErrorProps {
  kind: GentleErrorKind;
  /**
   * 「もう一度撮る」用のカメラ input の id。
   * これを渡すとボタンは <label htmlFor=...> になり、iOS Safari の
   * ユーザージェスチャー要件を確実に満たしたままネイティブピッカーを開ける。
   * 渡さない場合は onRetry のプログラマティック実行にフォールバック。
   */
  cameraInputId?: string;
  onRetry: () => void;
  onChooseAnother?: () => void;
  diagnostic?: PipelineDiagnostic;
}

interface ErrorContent {
  title: string;
  lines: string[];
  action: string;
  /** true のときは新しく撮り直す（＝カメラ input を開く） */
  reopenCamera: boolean;
}

const CONTENT: Record<GentleErrorKind, ErrorContent> = {
  permission: {
    title: "カメラを使わせてね",
    lines: ["モノモンを探すために", "カメラの使用をゆるしてね"],
    action: "もう一度",
    reopenCamera: true,
  },
  network: {
    title: "少し休憩しているみたい",
    lines: ["うまくつながらなかったみたい", "少し時間をあけて試してね"],
    action: "もう一度",
    reopenCamera: false,
  },
  busy: {
    title: "少し休憩しているみたい",
    lines: ["たくさんの出会いでちょっと一休み", "少し時間をあけて試してね"],
    action: "もう一度",
    reopenCamera: false,
  },
  too_far: {
    title: "もう少し近づいてね",
    lines: ["モノが小さく写っているみたい"],
    action: "もう一度撮る",
    reopenCamera: true,
  },
  too_dark: {
    title: "明るい場所で撮ってみよう",
    lines: ["少し暗くて見えにくいみたい"],
    action: "もう一度撮る",
    reopenCamera: true,
  },
  blurry: {
    title: "ゆっくり撮ってみよう",
    lines: ["少しぶれてしまったみたい"],
    action: "もう一度撮る",
    reopenCamera: true,
  },
  unclear: {
    title: "モノの姿が見つけにくかったみたい",
    lines: ["全体が写るように撮ってみよう"],
    action: "もう一度撮る",
    reopenCamera: true,
  },
  unknown: {
    title: "出会う準備が止まってしまったみたい",
    lines: ["もう一度試してみよう"],
    action: "もう一度撮る",
    reopenCamera: true,
  },
  generation_timeout: {
    title: "出会う準備に時間がかかったみたい",
    lines: ["写真はそのまま残っているよ"],
    action: "同じ写真でもう一度会う",
    reopenCamera: false,
  },
  generation_failed: {
    title: "出会う準備が止まってしまったみたい",
    lines: ["写真はそのまま残っているよ"],
    action: "同じ写真でもう一度会う",
    reopenCamera: false,
  },
  storage: {
    title: "思い出を残せなかったみたい",
    lines: ["写真はそのまま残っているよ"],
    action: "同じ写真でもう一度会う",
    reopenCamera: false,
  },
};

const BUTTON_CLASS =
  "mt-10 inline-block cursor-pointer rounded-full bg-foreground px-8 py-4 text-[14px] font-semibold tracking-[0.12em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]";

/** 絵本のような静かな案内。アイコンや派手な色は使わない。 */
export function GentleError({
  kind,
  onRetry,
  onChooseAnother,
  cameraInputId,
  diagnostic,
}: GentleErrorProps) {
  const { title, lines, action, reopenCamera } = CONTENT[kind];

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

      {reopenCamera && cameraInputId ? (
        // iOS Safari 対策：<label htmlFor> でネイティブジェスチャーを維持
        <label htmlFor={cameraInputId} className={BUTTON_CLASS} onClick={onRetry}>
          {action}
        </label>
      ) : (
        <button onClick={onRetry} className={BUTTON_CLASS}>
          {action}
        </button>
      )}

      {!reopenCamera && onChooseAnother && cameraInputId && (
        <label
          htmlFor={cameraInputId}
          className="mt-6 inline-block cursor-pointer text-[13px] font-medium tracking-[0.06em] text-foreground/50 active:opacity-70"
          onClick={onChooseAnother}
        >
          別のモノを撮る
        </label>
      )}

      {import.meta.env.DEV && diagnostic && (
        <p className="mt-8 max-w-xs text-left font-mono text-[10px] leading-relaxed text-foreground/35">
          生成に失敗しました<br />
          段階：{diagnostic.failedStage}<br />
          {diagnostic.status != null && <>状態：{diagnostic.status}<br /></>}
          {diagnostic.reason && <>理由：{diagnostic.reason}</>}
        </p>
      )}

      {kind === "permission" && (
        <p className="mt-6 max-w-xs text-[11px] leading-[2] tracking-[0.04em] text-foreground/40">
          ブラウザのカメラ許可を見直してね
        </p>
      )}
    </div>
  );
}
