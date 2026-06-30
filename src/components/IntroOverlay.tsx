import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MonomonArt } from "./MonomonArt";
import { tap } from "@/lib/sound";

interface IntroOverlayProps {
  onStart: () => void;
}

interface Slide {
  seed: number;
  speciesId: string;
  title: string;
  lines: string[];
}

const SLIDES: Slide[] = [
  {
    seed: 48127,
    speciesId: "cushion",
    title: "ようこそ Monomonへ",
    lines: ["身近なモノには", "小さな精霊「モノモン」が", "宿っているかもしれません"],
  },
  {
    seed: 90412,
    speciesId: "cup",
    title: "さがしてみよう",
    lines: ["家の中の気になるモノを", "撮ってみよう", "次は何を発見できるかな？"],
  },
  {
    seed: 31578,
    speciesId: "lamp",
    title: "モノモンと出会おう",
    lines: ["モノを大切にすると", "モノモンも喜びます", "さあ", "最初のモノモンを見つけよう"],
  },
];

/** 初回だけ表示する3枚のオンボーディング。 */
export function IntroOverlay({ onStart }: IntroOverlayProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const next = () => {
    tap();
    setStep((s) => Math.min(s + 1, SLIDES.length - 1));
  };

  const finish = () => {
    tap();
    onStart();
    navigate({ to: "/scan" });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col gradient-sky px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      {/* スキップ */}
      <div className="flex justify-end">
        {!isLast && (
          <button
            onClick={() => {
              tap();
              setStep(SLIDES.length - 1);
            }}
            className="rounded-full px-4 py-1.5 text-sm font-bold text-muted-foreground/80 transition-transform active:scale-95"
          >
            スキップ
          </button>
        )}
      </div>

      {/* メッセージ（1画面1メッセージ） */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mx-auto mb-12 h-40 w-40">
          <span className="absolute inset-2 rounded-full bg-primary/20 animate-pulse-ring" />
          <div
            key={step}
            className="relative h-full w-full animate-float-soft drop-shadow-[0_16px_24px_rgba(120,80,50,0.2)]"
          >
            <MonomonArt seed={slide.seed} speciesId={slide.speciesId} />
          </div>
        </div>

        <h2 key={`t-${step}`} className="text-[1.5rem] font-extrabold leading-snug text-foreground animate-rise-in">
          {slide.title}
        </h2>
        <p
          key={`b-${step}`}
          className="mt-6 text-base leading-loose text-muted-foreground animate-rise-in"
          style={{ animationDelay: "0.1s" }}
        >
          {slide.lines.map((line, i) => (
            <span key={i}>
              {line}
              {i < slide.lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      </div>

      {/* ページインジケーター */}
      <div className="mb-7 flex justify-center gap-2">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === step ? "w-6 bg-primary" : "w-2 bg-primary/25"
            }`}
          />
        ))}
      </div>

      {/* アクション */}
      {isLast ? (
        <button
          onClick={finish}
          className="w-full rounded-full gradient-primary py-4 text-lg font-bold text-primary-foreground shadow-float transition-transform active:scale-95"
        >
          さがしにいく
        </button>
      ) : (
        <button
          onClick={next}
          className="w-full rounded-full gradient-primary py-4 text-lg font-bold text-primary-foreground shadow-float transition-transform active:scale-95"
        >
          つぎへ
        </button>
      )}
    </div>
  );
}
