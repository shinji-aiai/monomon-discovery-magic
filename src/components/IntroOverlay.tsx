import { tap } from "@/lib/sound";

interface IntroOverlayProps {
  onStart: () => void;
}

/** 初回だけ表示する短い説明。 */
export function IntroOverlay({ onStart }: IntroOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center gradient-sky px-7">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto mb-10 h-32 w-32">
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full gradient-magic shadow-glow animate-float-soft text-6xl">
            ✨
          </div>
        </div>

        <p className="text-[1.35rem] font-bold leading-relaxed text-foreground animate-rise-in">
          身の回りのモノには、
          <br />
          小さな精霊が宿っています。
        </p>
        <p
          className="mt-5 text-base leading-relaxed text-muted-foreground animate-rise-in"
          style={{ animationDelay: "0.12s" }}
        >
          写真を撮ると、
          <br />
          その姿が見つかるかもしれません。
        </p>

        <button
          onClick={() => {
            tap();
            onStart();
          }}
          className="mt-12 w-full rounded-full gradient-primary py-4 text-lg font-bold text-primary-foreground shadow-float transition-transform active:scale-95 animate-rise-in"
          style={{ animationDelay: "0.24s" }}
        >
          はじめる
        </button>
      </div>
    </div>
  );
}
