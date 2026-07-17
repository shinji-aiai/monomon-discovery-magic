import { useNavigate } from "@tanstack/react-router";
import homeCompanion from "@/assets/home-companion.png";
import { tap } from "@/lib/sound";

interface IntroOverlayProps {
  onStart: () => void;
}

/**
 * 初回のようこそ画面。
 * v3.0：3枚の説明を廃止。一枚絵と一文だけ。
 * 実物のモノ（マグに宿る精霊のイラスト）を主役にする。
 */
export function IntroOverlay({ onStart }: IntroOverlayProps) {
  const navigate = useNavigate();

  const finish = () => {
    tap();
    onStart();
    navigate({ to: "/scan" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: "#FAF8F3" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative w-[16rem] sm:w-[18rem]">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-4 rounded-[40px]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(210,180,130,0.20), rgba(210,180,130,0) 72%)",
            }}
          />
          <div className="animate-idle-breathe">
            <img
              src={homeCompanion}
              alt=""
              width={1024}
              height={1024}
              className="relative h-auto w-full object-contain drop-shadow-[0_20px_36px_rgba(90,65,35,0.20)]"
            />
          </div>
        </div>

        <p className="mt-12 whitespace-pre-line text-[15px] font-medium leading-[2] tracking-[0.02em] text-foreground/70">
          {"身のまわりのモノには\n小さな気配が\n宿っているかもしれません"}
        </p>
      </div>

      <button
        onClick={finish}
        className="w-full rounded-full bg-foreground py-[18px] text-[15px] font-semibold tracking-[0.14em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]"
      >
        はじめる
      </button>

      <button
        onClick={() => {
          tap();
          onStart();
        }}
        className="mt-3 py-2 text-[12px] font-medium tracking-[0.08em] text-foreground/40 active:opacity-70"
      >
        あとで
      </button>
    </div>
  );
}
