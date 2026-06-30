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

/**
 * 探索の各段階。
 *  - SCAN〜SILHOUETTE: 写真から「なにかが現れる」までの導入演出
 *  - APPEAR/NAME/QUOTE: ④ モノモン発見演出（シルエット → 姿 → 名前 → 一言）
 */
const STAGE = {
  SCAN: 0,
  OUTLINE: 1,
  PARTICLES: 2,
  SILHOUETTE: 3,
  FLASH: 4,
  APPEAR: 5,
  NAME: 6,
  QUOTE: 7,
} as const;

const SCAN_LABELS = [
  "解析中…",
  "写真の輪郭が光っています…",
  "光の粒が集まってきた…",
  "なにかが現れる…",
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 写真 → 輪郭が光る → 光の粒 → シルエット → 姿 → 名前 → 一言 の演出。
 * 後半（④ 発見演出）は、生成されたモノモン本人の姿・名前・一言で構成します。
 */
export function DiscoveryReveal({ photo, generate, onDone }: DiscoveryRevealProps) {
  const [stage, setStage] = useState<number>(STAGE.SCAN);
  const [monomon, setMonomon] = useState<Monomon | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const genPromise = generate();

    (async () => {
      playSound("scan");
      await wait(900);
      if (cancelled.current) return;
      setStage(STAGE.OUTLINE);
      await wait(650);
      if (cancelled.current) return;
      setStage(STAGE.PARTICLES);
      playSound("scan");
      await wait(750);
      if (cancelled.current) return;

      // 生成完了を待ってから「本人の姿」でシルエットを見せる（姿の一貫性）
      const found = await genPromise;
      if (cancelled.current) return;
      setMonomon(found);
      setStage(STAGE.SILHOUETTE);
      haptic(14);
      await wait(820);
      if (cancelled.current) return;

      setStage(STAGE.FLASH);
      playSound("discover");
      haptic([18, 40, 28]);
      await wait(360);
      if (cancelled.current) return;

      // ④-1 姿があらわれる
      setStage(STAGE.APPEAR);
      await wait(820);
      if (cancelled.current) return;
      // ④-2 名前
      setStage(STAGE.NAME);
      playSound("save");
      await wait(1100);
      if (cancelled.current) return;
      // ④-3 一言
      setStage(STAGE.QUOTE);
      await wait(1900);
      if (cancelled.current) return;

      onDone(found);
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

  const revealing = stage >= STAGE.APPEAR;
  const objectLabel = monomon?.objectLabel?.trim();

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {/* 導入演出（写真 → シルエット） */}
      {!revealing && (
        <>
          <div
            className={`relative h-64 w-64 overflow-hidden rounded-[34px] transition-all duration-500 ${
              stage === STAGE.OUTLINE ? "animate-outline-glow" : "shadow-float"
            }`}
          >
            {/* 写真 */}
            <img
              src={photo}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
                stage >= STAGE.PARTICLES ? "scale-110 blur-[2px] brightness-50" : ""
              }`}
            />

            {/* スキャンライン */}
            {stage <= STAGE.OUTLINE && (
              <>
                <div className="absolute inset-0 bg-foreground/15" />
                <div className="absolute inset-x-3 h-1 animate-scan-sweep rounded-full bg-gradient-to-r from-transparent via-white to-transparent shadow-glow" />
              </>
            )}

            {/* 暗転＋光の粒 */}
            {stage >= STAGE.PARTICLES && (
              <div className="absolute inset-0 bg-foreground/55" />
            )}
            {stage === STAGE.PARTICLES && (
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

            {/* シルエット＋光る目（本人の姿で） */}
            {stage === STAGE.SILHOUETTE && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-52 w-52 animate-silhouette">
                  <div className="h-full w-full opacity-90 [filter:brightness(0)_drop-shadow(0_0_18px_rgba(255,245,210,0.6))]">
                    {monomon ? (
                      <MonomonArt monomon={monomon} />
                    ) : (
                      <MonomonArt seed={777} speciesId="clock" />
                    )}
                  </div>
                  <span className="animate-eye-glow absolute left-[40%] top-[44%] h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_12px_4px_rgba(255,245,200,0.9)]" />
                  <span className="animate-eye-glow absolute right-[40%] top-[44%] h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_12px_4px_rgba(255,245,200,0.9)]" />
                </div>
              </div>
            )}

            {/* フラッシュ */}
            {stage === STAGE.FLASH && (
              <div className="animate-flash absolute inset-0 z-10 bg-white" />
            )}
          </div>

          <p
            key={stage}
            className="mt-10 flex animate-rise-in items-center gap-2 text-lg font-bold text-foreground"
          >
            {SCAN_LABELS[Math.min(stage, SCAN_LABELS.length - 1)]}
          </p>

          <div className="mt-4 flex gap-2">
            {SCAN_LABELS.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i <= stage ? "w-6 bg-primary" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* ④ 発見演出（姿 → 名前 → 一言） */}
      {revealing && monomon && (
        <div className="flex flex-col items-center">
          {/* 姿 */}
          <div className="relative flex h-60 w-60 items-center justify-center">
            <span className="absolute inset-0 rounded-full gradient-magic opacity-25 blur-2xl" />
            <span className="absolute inset-6 animate-pulse-ring rounded-full border border-primary/30" />
            <div className="relative h-48 w-48 animate-jump-out drop-shadow-[0_10px_30px_rgba(120,90,60,0.25)]">
              <MonomonArt monomon={monomon} />
            </div>
          </div>

          {/* 名前 */}
          {stage >= STAGE.NAME && (
            <div key="name" className="mt-4 animate-pop-in text-center">
              {objectLabel && (
                <p className="text-xs font-bold text-muted-foreground">
                  {monomon.uncertain
                    ? `${objectLabel}の仲間かもしれない`
                    : `${objectLabel}に宿る`}
                </p>
              )}
              <h2 className="mt-0.5 flex items-center justify-center gap-1.5 text-2xl font-extrabold text-foreground">
                <Sparkles className="h-5 w-5 text-primary" />
                {monomon.name}
              </h2>
            </div>
          )}

          {/* 一言 */}
          {stage >= STAGE.QUOTE && (
            <div
              key="quote"
              className="mt-4 max-w-xs animate-rise-in rounded-3xl bg-card px-5 py-3 text-sm leading-relaxed text-card-foreground shadow-soft"
            >
              「{monomon.description}」
            </div>
          )}
        </div>
      )}
    </div>
  );
}
