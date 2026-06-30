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
 * 「モノモンとの出会い」の演出（7段階）。
 *  SCAN  : そっと見つめる導入（写真）
 *  ① GATHER     : 光が集まる
 *  ② SILHOUETTE : シルエットが現れる
 *  ③ PAUSE      : 0.5〜1秒、静かに間を置く
 *  ④ EYES       : 目だけ先に光る
 *  ⑤ APPEAR     : 姿がゆっくり現れる
 *  ⑥ NAME       : 名前が表示される
 *  ⑦ QUOTE      : その子が一言話す
 *
 * 派手にせず、やさしく・少し不思議で・思わず微笑む“出会い”を目指す。
 */
const STAGE = {
  SCAN: 0,
  GATHER: 1,
  SILHOUETTE: 2,
  PAUSE: 3,
  EYES: 4,
  APPEAR: 5,
  NAME: 6,
  QUOTE: 7,
} as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DiscoveryReveal({ photo, generate, onDone }: DiscoveryRevealProps) {
  const [stage, setStage] = useState<number>(STAGE.SCAN);
  const [monomon, setMonomon] = useState<Monomon | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const genPromise = generate();

    (async () => {
      // 導入：そっと見つめる
      playSound("scan");
      await wait(1100);
      if (cancelled.current) return;

      // ① 光が集まる
      setStage(STAGE.GATHER);
      await wait(1100);
      if (cancelled.current) return;

      // 生成完了を待ってから「本人の姿」でシルエットを見せる（姿の一貫性）
      const found = await genPromise;
      if (cancelled.current) return;
      setMonomon(found);

      // ② シルエットが現れる
      setStage(STAGE.SILHOUETTE);
      haptic(12);
      await wait(750);
      if (cancelled.current) return;

      // ③ 静かに間を置く（0.5〜1秒）
      setStage(STAGE.PAUSE);
      await wait(850);
      if (cancelled.current) return;

      // ④ 目だけ先に光る
      setStage(STAGE.EYES);
      haptic(10);
      await wait(950);
      if (cancelled.current) return;

      // ⑤ 姿がゆっくり現れる
      setStage(STAGE.APPEAR);
      playSound("discover");
      haptic(16);
      await wait(1500);
      if (cancelled.current) return;

      // ⑥ 名前
      setStage(STAGE.NAME);
      playSound("save");
      await wait(1300);
      if (cancelled.current) return;

      // ⑦ 一言
      setStage(STAGE.QUOTE);
      await wait(2200);
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
      delay: `${(i % 6) * 0.06}s`,
      size: 5 + (i % 3) * 3,
    };
  });

  const showSilhouette = stage >= STAGE.SILHOUETTE && stage < STAGE.APPEAR;
  const showEyes = stage >= STAGE.EYES && stage < STAGE.APPEAR;
  const showColor = stage >= STAGE.APPEAR;

  const captions: Record<number, string> = {
    [STAGE.SCAN]: "この子をそっと見つめている…",
    [STAGE.GATHER]: "光が集まってきた…",
    [STAGE.SILHOUETTE]: "なにかがそこにいる…",
    [STAGE.PAUSE]: "…",
    [STAGE.EYES]: "ふと目が合った",
  };
  const caption = captions[stage];

  const objectLabel = monomon?.objectLabel?.trim();

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {/* 出会いの舞台（写真 → 光 → シルエット → 姿） */}
      <div className="relative h-64 w-64 overflow-hidden rounded-[34px] shadow-float">
        {/* 写真（進むほど静かに沈む） */}
        <img
          src={photo}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ${
            stage >= STAGE.GATHER ? "scale-110 blur-[3px] brightness-[0.35]" : ""
          } ${showColor ? "opacity-0" : "opacity-100"}`}
        />

        {/* 暗がり */}
        {stage >= STAGE.GATHER && !showColor && (
          <div className="absolute inset-0 bg-foreground/55 transition-opacity duration-700" />
        )}

        {/* ① 光が集まる */}
        {stage === STAGE.GATHER && (
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

        {/* ②③④ シルエット（目は④で先に光る） */}
        {showSilhouette && monomon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`relative h-52 w-52 ${
                stage === STAGE.SILHOUETTE ? "animate-silhouette" : ""
              }`}
            >
              <div className="h-full w-full opacity-90 [filter:brightness(0)_drop-shadow(0_0_18px_rgba(255,245,210,0.55))]">
                <MonomonArt monomon={monomon} />
              </div>
              {showEyes && (
                <>
                  <span className="animate-eye-glow absolute left-[40%] top-[44%] h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_12px_4px_rgba(255,245,200,0.9)]" />
                  <span className="animate-eye-glow absolute right-[40%] top-[44%] h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_12px_4px_rgba(255,245,200,0.9)]" />
                </>
              )}
            </div>
          </div>
        )}

        {/* ⑤ 姿がゆっくり現れる */}
        {showColor && monomon && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* やわらかい光のにじみ（フラッシュの代わり） */}
            <span className="absolute inset-0 m-auto h-48 w-48 animate-soft-bloom rounded-full gradient-magic" />
            <div className="relative h-52 w-52 animate-soft-emerge drop-shadow-[0_10px_30px_rgba(120,90,60,0.25)]">
              <MonomonArt monomon={monomon} />
            </div>
          </div>
        )}
      </div>

      {/* 導入〜出会いのことば */}
      {caption && (
        <p
          key={stage}
          className="mt-10 min-h-[1.75rem] animate-rise-in text-lg font-bold text-foreground"
        >
          {caption}
        </p>
      )}

      {/* ⑥ 名前 */}
      {stage >= STAGE.NAME && monomon && (
        <div key="name" className="mt-9 animate-pop-in text-center">
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

      {/* ⑦ 一言 */}
      {stage >= STAGE.QUOTE && monomon && (
        <div
          key="quote"
          className="mt-4 max-w-xs animate-rise-in rounded-3xl bg-card px-5 py-3 text-sm leading-relaxed text-card-foreground shadow-soft"
        >
          「{monomon.description}」
        </div>
      )}
    </div>
  );
}
