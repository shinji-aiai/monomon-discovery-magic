import { MonomonArt } from "./MonomonArt";
import { tap } from "@/lib/sound";

interface IntroOverlayProps {
  onStart: () => void;
}

/** 初回だけ表示する短い説明。 */
export function IntroOverlay({ onStart }: IntroOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center gradient-sky px-7">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto mb-10 h-36 w-36">
          <span className="absolute inset-2 rounded-full bg-primary/20 animate-pulse-ring" />
          <div className="relative h-full w-full animate-float-soft drop-shadow-[0_16px_24px_rgba(120,80,50,0.2)]">
            <MonomonArt seed={48127} category="ぬくもり種" />
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
