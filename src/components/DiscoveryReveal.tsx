import { useEffect, useMemo, useRef, useState } from "react";
import { MonomonArt } from "./MonomonArt";
import {
  DiscoveryError,
  type DiscoveryErrorKind,
  type Monomon,
} from "@/lib/monomon";
import { haptic } from "@/lib/sound";

interface DiscoveryRevealProps {
  photo: string;
  generate: () => Promise<Monomon>;
  /** 生成が成功した直後に一度だけ呼ばれる（演出を待たずに保存するため）。 */
  onGenerated?: (m: Monomon) => void;
  onDone: (m: Monomon) => void;
  onError: (kind: DiscoveryErrorKind) => void;
  onCancel: () => void;
}

/**
 * 出会いの演出。
 *
 * v3.0：技術語・キラキラ演出・紙吹雪・銅鑼のような音は撤去。
 * 呼吸するようなゆっくりした一連のシーケンスで、最後に「出会えた。」だけを残す。
 *
 *  1. HUSH       — 写真がそっと沈む
 *  2. GATHER     — 柔らかな光の粒がゆっくり集まる
 *  3. PEEK       — モノモンが端から静かに覗く（実物写真の中に）
 *  4. GREETING   — 「出会えた。」の一文
 *  5. NAME       — モノとその子の名前が控えめに現れる
 */
const STAGE = {
  HUSH: 0,
  GATHER: 1,
  PEEK: 2,
  GREETING: 3,
  NAME: 4,
} as const;

/** 合成モデルの応答を含めた最大待ち時間。超えたら「今日はうまく会えなかった」表示。 */
const STUCK_MS = 35_000;

export function DiscoveryReveal({
  photo,
  generate,
  onGenerated,
  onDone,
  onError,
  onCancel,
}: DiscoveryRevealProps) {
  const [stage, setStage] = useState<number>(STAGE.HUSH);
  const [monomon, setMonomon] = useState<Monomon | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const skipResolve = useRef<(() => void) | null>(null);
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        skipResolve.current = null;
        resolve();
      }, ms);
      skipResolve.current = () => {
        clearTimeout(t);
        resolve();
      };
    });

  const advance = () => {
    if (timedOut) return;
    skipResolve.current?.();
  };

  useEffect(() => {
    let alive = true;
    setStage(STAGE.HUSH);
    setMonomon(null);
    setTimedOut(false);

    const genPromise = generate();
    let stuckTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      // 1. 写真がそっと沈む
      await wait(1100);
      if (!alive) return;

      // 2. 光が集まる（AIの完了を待つ）
      setStage(STAGE.GATHER);
      stuckTimer = setTimeout(() => alive && setTimedOut(true), STUCK_MS);

      let found: Monomon;
      try {
        found = await genPromise;
      } catch (e) {
        clearTimeout(stuckTimer);
        if (!alive) return;
        onError(e instanceof DiscoveryError ? e.kind : "unknown");
        return;
      }
      clearTimeout(stuckTimer);
      if (!alive) return;
      setTimedOut(false);
      setMonomon(found);

      // 光がしばらく集まり続ける余韻
      await wait(1400);
      if (!alive) return;

      // 3. モノモンが覗く
      setStage(STAGE.PEEK);
      haptic(10);
      await wait(1500);
      if (!alive) return;

      // 4. 出会えた。
      setStage(STAGE.GREETING);
      await wait(1800);
      if (!alive) return;

      // 5. 名前
      setStage(STAGE.NAME);
      await wait(2000);
      if (!alive) return;

      onDone(found);
    })();

    return () => {
      alive = false;
      clearTimeout(stuckTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // 光の粒（ゆっくり集まり続ける）
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const ang = (i / 10) * Math.PI * 2 + 0.3;
        const dist = 130 + (i % 3) * 22;
        return {
          tx: `${Math.cos(ang) * dist}px`,
          ty: `${Math.sin(ang) * dist}px`,
          delay: `${(i % 5) * 0.4}s`,
          size: 4 + (i % 3) * 2,
        };
      }),
    [],
  );

  // タイムアウト時：閉じ込めないやさしい退避
  if (timedOut) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
        style={{ backgroundColor: "#FAF8F3" }}
      >
        <p className="whitespace-pre-line text-[15px] font-medium leading-[2] text-foreground/60">
          {"今日はうまく\n会えなかったみたい"}
        </p>
        <button
          onClick={() => {
            haptic(10);
            setAttempt((a) => a + 1);
          }}
          className="mt-10 rounded-full bg-foreground px-8 py-4 text-[14px] font-semibold tracking-[0.12em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]"
        >
          もう一度
        </button>
        <button
          onClick={onCancel}
          className="mt-6 text-[13px] font-medium tracking-[0.06em] text-foreground/45 active:opacity-70"
        >
          そっと戻る
        </button>
      </div>
    );
  }

  const showMonomon = stage >= STAGE.PEEK && monomon;
  const objectLabel = monomon?.objectLabel?.trim();

  return (
    <div
      onClick={advance}
      className="fixed inset-0 z-50 flex cursor-pointer select-none flex-col items-center justify-center px-8"
      style={{ backgroundColor: "#FAF8F3" }}
    >
      {/* 出会いの舞台：実物写真は主役のまま。少しだけ沈む */}
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-8 rounded-[40px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,225,175,0.28), rgba(255,225,175,0) 72%)",
          }}
        />
        <div
          className="relative h-72 w-72 overflow-hidden rounded-[32px] sm:h-80 sm:w-80"
          style={{ boxShadow: "0 24px 48px -22px rgba(60,45,25,0.34)" }}
        >
          {/* 元写真：常に下敷き（合成が失敗しても体験が完結） */}
          <img
            src={photo}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1400ms] ease-out ${
              stage >= STAGE.GATHER ? "scale-[1.04] brightness-[0.82]" : ""
            }`}
          />

          {/* 合成写真：PEEK 以降にゆっくり浮かび上がる（あるときだけ） */}
          {monomon?.composedPhoto && (
            <img
              src={monomon.composedPhoto}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-out ${
                stage >= STAGE.PEEK ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* 光の粒がゆっくり内側に集まる */}
          {stage >= STAGE.GATHER && stage < STAGE.PEEK && (
            <div className="pointer-events-none absolute inset-0">
              {particles.map((p, i) => (
                <span
                  key={i}
                  className="animate-slow-converge absolute left-1/2 top-1/2 rounded-full bg-amber-100/95 shadow-[0_0_18px_6px_rgba(255,235,190,0.55)]"
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

          {/* 合成が無いときの控えめなSVGモノモン（フォールバック） */}
          {showMonomon && !monomon?.composedPhoto && (
            <div className="pointer-events-none absolute -bottom-2 -right-1 h-28 w-28 sm:h-32 sm:w-32">
              <div className="animate-soft-peek h-full w-full drop-shadow-[0_10px_18px_rgba(60,45,25,0.32)]">
                <MonomonArt monomon={monomon!} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 「出会えた。」— たった一言 */}
      <div className="mt-10 min-h-[3.5rem] text-center">
        {stage >= STAGE.GREETING && (
          <p
            key="greeting"
            className="animate-quiet-in text-[22px] font-semibold tracking-[0.14em] text-foreground/80"
          >
            出会えた。
          </p>
        )}
      </div>

      {/* 名前は少し遅れて、小さく */}
      <div className="mt-2 min-h-[3rem] text-center">
        {stage >= STAGE.NAME && monomon && (
          <div key="name" className="animate-quiet-in">
            {objectLabel && (
              <p className="text-[11px] font-medium tracking-[0.16em] text-foreground/40">
                {monomon.uncertain
                  ? `${objectLabel}のなかまかもしれない`
                  : `${objectLabel}にやどる`}
              </p>
            )}
            <p className="mt-2 text-[16px] font-medium tracking-[0.06em] text-foreground/75">
              {monomon.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
