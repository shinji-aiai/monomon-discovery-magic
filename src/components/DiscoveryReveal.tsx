import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Moon, RefreshCw } from "lucide-react";
import { MonomonArt } from "./MonomonArt";
import { DiscoveryError, type DiscoveryErrorKind, type Monomon } from "@/lib/monomon";
import { playSound, haptic } from "@/lib/sound";
import { greetingFor } from "@/lib/greetings";

interface DiscoveryRevealProps {
  photo: string;
  /** モノモン生成（解析と並行して実行） */
  generate: () => Promise<Monomon>;
  onDone: (m: Monomon) => void;
  /** うまく出会えなかったとき（通信・混雑・見つからない） */
  onError: (kind: DiscoveryErrorKind) => void;
  /** 演出をやめて前の画面へそっと戻る（長時間の待ちからの退避） */
  onCancel: () => void;
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
 * AI認識が長引いても閉じ込めないよう、一定時間でやさしい退避画面を出す。
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

/** これ以上待つと無言になってしまう、やさしい退避のめやす。 */
const STUCK_MS = 8000;


export function DiscoveryReveal({
  photo,
  generate,
  onDone,
  onError,
  onCancel,
}: DiscoveryRevealProps) {
  const [stage, setStage] = useState<number>(STAGE.SCAN);
  const [monomon, setMonomon] = useState<Monomon | null>(null);
  /** AI認識が長引いているか（無反応に見せないための優しいメッセージ） */
  const [searching, setSearching] = useState(false);
  /** さらに長引いたとき：閉じ込めないためのやさしい退避画面 */
  const [timedOut, setTimedOut] = useState(false);
  /** 「もう一度ためす」で演出をやり直すための試行カウント */
  const [attempt, setAttempt] = useState(0);
  /** タップ送り用：現在の待機を即座に切り上げるフラグ */
  const skipRef = useRef(false);
  const skipResolve = useRef<(() => void) | null>(null);

  /** タップで次の段へ。待機中ならその待機を即終了する。 */
  const advance = () => {
    if (timedOut) return;
    skipRef.current = true;
    if (skipResolve.current) {
      skipResolve.current();
      skipResolve.current = null;
    }
  };

  /** 中断（タップ）で早送りできる待機。 */
  const waitOrSkip = (ms: number) =>
    new Promise<void>((resolve) => {
      skipRef.current = false;
      const timer = setTimeout(() => {
        skipResolve.current = null;
        resolve();
      }, ms);
      skipResolve.current = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  useEffect(() => {
    let alive = true;
    setStage(STAGE.SCAN);
    setMonomon(null);
    setSearching(false);
    setTimedOut(false);

    const genPromise = generate();
    let slowTimer: ReturnType<typeof setTimeout> | undefined;
    let stuckTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      // 導入：そっと見つめる
      playSound("scan");
      await waitOrSkip(900);
      if (!alive) return;

      // ① 光が集まる
      setStage(STAGE.GATHER);
      await waitOrSkip(900);
      if (!alive) return;

      // 生成完了を待ってから「本人の姿」でシルエットを見せる（姿の一貫性）
      // AIが長引くときは「いま探しているよ…」を出し、無反応に見せない。
      // さらに長引くときは、やさしい退避画面を出して閉じ込めない。
      slowTimer = setTimeout(() => {
        if (alive) setSearching(true);
      }, 600);
      stuckTimer = setTimeout(() => {
        if (alive) setTimedOut(true);
      }, STUCK_MS);

      let found: Monomon;
      try {
        found = await genPromise;
      } catch (e) {
        clearTimeout(slowTimer);
        clearTimeout(stuckTimer);
        setSearching(false);
        if (!alive) return;
        onError(e instanceof DiscoveryError ? e.kind : "unknown");
        return;
      }
      clearTimeout(slowTimer);
      clearTimeout(stuckTimer);
      setSearching(false);
      if (!alive) return;
      // 退避画面を出していても、ようやく見つかったらそのまま出会いへ。
      setTimedOut(false);
      setMonomon(found);

      // ② シルエットが現れる
      setStage(STAGE.SILHOUETTE);
      haptic(12);
      await waitOrSkip(650);
      if (!alive) return;

      // ③ 静かに間を置く（0.5〜1秒）
      setStage(STAGE.PAUSE);
      await waitOrSkip(650);
      if (!alive) return;

      // ④ 目だけ先に光る
      setStage(STAGE.EYES);
      haptic(10);
      await waitOrSkip(650);
      if (!alive) return;

      // ⑤ 姿がゆっくり現れる
      setStage(STAGE.APPEAR);
      playSound("discover");
      haptic(16);
      await waitOrSkip(1200);
      if (!alive) return;

      // ⑥ 名前
      setStage(STAGE.NAME);
      playSound("save");
      await waitOrSkip(950);
      if (!alive) return;

      // ⑦ 一言
      setStage(STAGE.QUOTE);
      await waitOrSkip(1400);
      if (!alive) return;

      onDone(found);
    })();

    return () => {
      alive = false;
      clearTimeout(slowTimer);
      clearTimeout(stuckTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // 長く待っても見つからないとき：閉じ込めないやさしい退避画面
  if (timedOut) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full gradient-magic shadow-glow animate-breathe">
          <Moon className="h-12 w-12 text-card" strokeWidth={1.6} />
        </div>
        <h2 className="text-xl font-extrabold text-foreground">
          まだ見つからないみたい
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          <span className="block">モノモンはゆっくり探しているよ</span>
          <span className="block">もう一度ためすか そっと戻ってね</span>
        </p>

        <button
          onClick={() => {
            haptic(12);
            setAttempt((a) => a + 1);
          }}
          className="mt-10 flex items-center justify-center gap-2.5 rounded-full gradient-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-float active:scale-95"
        >
          <RefreshCw className="h-5 w-5" />
          もう一度ためす
        </button>
        <button
          onClick={onCancel}
          className="mt-5 text-sm font-bold text-muted-foreground active:scale-95"
        >
          とじる
        </button>
      </div>
    );
  }

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
  const caption =
    searching && stage === STAGE.GATHER ? "いま探しているよ…" : captions[stage];

  const objectLabel = monomon?.objectLabel?.trim();

  return (
    <div
      onClick={advance}
      className="flex flex-1 cursor-pointer select-none flex-col items-center justify-center text-center"
    >
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

        {/* ⑤ 姿がゆっくり現れる → 少し嬉しそうに跳ねて、そっと浮き続ける */}
        {showColor && monomon && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* やわらかい光のにじみ（フラッシュの代わり） */}
            <span className="absolute inset-0 m-auto h-48 w-48 animate-soft-bloom rounded-full gradient-magic" />
            <div className="relative h-52 w-52 animate-soft-emerge drop-shadow-[0_10px_30px_rgba(120,90,60,0.25)]">
              {/* 出会えた喜びのひと跳ね（一度だけ） */}
              <div className={stage >= STAGE.NAME ? "h-full w-full animate-greet-hop" : "h-full w-full"}>
                {/* 生命を感じる、ふわっとした浮遊（ずっと） */}
                <div className={stage >= STAGE.NAME ? "h-full w-full animate-life-float" : "h-full w-full"}>
                  <MonomonArt monomon={monomon} />
                </div>
              </div>
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

      {/* タップ送りのヒント（最後の段までそっと表示） */}
      {stage < STAGE.QUOTE && (
        <p className="mt-8 animate-fade-in text-xs font-medium text-muted-foreground/70">
          タップで進む
        </p>
      )}
    </div>
  );
}
