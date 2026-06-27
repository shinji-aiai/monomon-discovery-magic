import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { MonomonArt } from "./MonomonArt";
import type { Monomon } from "@/lib/monomon";
import { playSound, haptic } from "@/lib/sound";

interface DiscoveryRevealProps {
  photo: string;
  /** モノモン生成（解析と並行して実行） */
  generate: () => Promise<Monomon>;
  onDone: (m: Monomon) => void;
}

const STEP_LABELS = [
  "解析中…",
  "写真の輪郭が光っています…",
  "光の粒が集まってきた…",
  "なにかが現れる…",
  "モノモン、発見！",
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 写真 → 輪郭が光る → 光の粒 → シルエット → 目が光る → 発見！の演出（約3秒）。 */
export function DiscoveryReveal({ photo, generate, onDone }: DiscoveryRevealProps) {
  const [stage, setStage] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const genPromise = generate();

    (async () => {
      playSound("scan");
      await wait(900);
      if (cancelled.current) return;
      setStage(1);
      await wait(650);
      if (cancelled.current) return;
      setStage(2);
      playSound("scan");
      await wait(750);
      if (cancelled.current) return;
      setStage(3);
      haptic(14);
      const monomon = await genPromise;
      await wait(650);
      if (cancelled.current) return;
      setStage(4);
      playSound("discover");
      haptic([18, 40, 28]);
      await wait(560);
      if (cancelled.current) return;
      onDone(monomon);
    })();

    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 収束する光の粒
  const particles = Array.from({ length: 12 }, (_, i) => {
    const ang = (i / 12) * Math.PI * 2;
    const dist = 120 + (i % 3) * 26;
    return {
      tx: `${Math.cos(ang) * dist}px`,
      ty: `${Math.sin(ang) * dist}px`,
      delay: `${(i % 6) * 0.05}s`,
      size: 6 + (i % 3) * 3,
    };
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div
        className={`relative h-64 w-64 overflow-hidden rounded-[34px] transition-all duration-500 ${
          stage === 1 ? "animate-outline-glow" : "shadow-float"
        }`}
      >
        {/* 写真 */}
        <img
          src={photo}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
            stage >= 2 ? "scale-110 blur-[2px] brightness-50" : ""
          }`}
        />

        {/* スキャンライン */}
        {stage <= 1 && (
          <>
            <div className="absolute inset-0 bg-foreground/15" />
            <div className="absolute inset-x-3 h-1 animate-scan-sweep rounded-full bg-gradient-to-r from-transparent via-white to-transparent shadow-glow" />
          </>
        )}

        {/* 暗転＋光の粒 */}
        {stage >= 2 && (
          <div className="absolute inset-0 bg-foreground/55" />
        )}
        {stage === 2 && (
          <div className="absolute inset-0">
            {particles.map((p, i) => (
              <span
                key={i}
                className="animate-converge absolute left-1/2 top-1/2 rounded-full bg-amber-100 shadow-glow"
                style={{
                  width: p.size,
                  height: p.size,
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  // @ts-expect-error custom props
                  "--tx": p.tx,
                  "--ty": p.ty,
                  animationDelay: p.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* シルエット＋光る目 */}
        {stage === 3 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-52 w-52 animate-silhouette">
              <div className="h-full w-full opacity-90 [filter:brightness(0)_drop-shadow(0_0_18px_rgba(255,245,210,0.6))]">
                <MonomonArt seed={777} category="ふしぎ種" />
              </div>
              <span className="animate-eye-glow absolute left-[40%] top-[44%] h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_12px_4px_rgba(255,245,200,0.9)]" />
              <span className="animate-eye-glow absolute right-[40%] top-[44%] h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_12px_4px_rgba(255,245,200,0.9)]" />
            </div>
          </div>
        )}

        {/* フラッシュ */}
        {stage === 4 && (
          <div className="animate-flash absolute inset-0 z-10 bg-white" />
        )}
      </div>

      <p
        key={stage}
        className="mt-10 flex animate-rise-in items-center gap-2 text-lg font-bold text-foreground"
      >
        {stage === 4 && <Sparkles className="h-5 w-5 text-primary" />}
        {STEP_LABELS[stage]}
      </p>

      <div className="mt-4 flex gap-2">
        {STEP_LABELS.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              i <= stage ? "w-6 bg-primary" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
