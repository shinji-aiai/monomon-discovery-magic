import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MonomonArt } from "@/components/MonomonArt";
import homeCompanion from "@/assets/home-companion.png";
import { BottomNav } from "@/components/BottomNav";
import { useSettings, updateSettings } from "@/lib/settings";
import { useDex } from "@/lib/dex";
import { trackFindClick } from "@/lib/analytics";
import { FAMILY_STYLES } from "@/lib/monomon-data";
import type { Monomon } from "@/lib/monomon";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "モノモン｜モノに宿る小さな精霊たち" },
      {
        name: "description",
        content:
          "身の回りのモノを撮るとそのモノに宿る小さな精霊が見つかる",
      },
      { property: "og:title", content: "モノモン｜モノに宿る小さな精霊たち" },
      {
        property: "og:description",
        content: "写真を撮るとモノに宿る小さな精霊が見つかる",
      },
    ],
  }),
  component: Home,
});

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "こんばんは";
  if (h < 11) return "おはようございます";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

const AMBIENT_LINES = [
  "きょうも\nすてきな出会いが\nまっています",
  "身の回りに\nそっと目を向けてみて",
  "小さな気配が\nあなたを待っています",
];

function lineFor(companion: Monomon | undefined): string {
  if (!companion) {
    const day = Math.floor(Date.now() / 86_400_000);
    return AMBIENT_LINES[day % AMBIENT_LINES.length];
  }
  const noun = companion.objectLabel?.trim() || FAMILY_STYLES[companion.family].label;
  const templates = [
    `今日は${noun}が\nすこし嬉しそうです`,
    `今日は${noun}のそばが\nあたたかい気配です`,
    `${noun}が\n静かに息をしています`,
  ];
  const day = Math.floor(Date.now() / 86_400_000);
  return templates[day % templates.length];
}

function Home() {
  const settings = useSettings();
  const dex = useDex();

  const companion = useMemo(
    () => dex.find((m) => m.favorite) ?? dex[0],
    [dex],
  );
  const latest = useMemo(() => dex[0], [dex]);

  const [greet, setGreet] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    setGreet(greeting());
    setLine(lineFor(companion));
  }, [companion]);

  return (
    <div
      className="relative flex min-h-[100svh] flex-col px-7 pb-32 pt-[max(1.75rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: "#FAF8F3" }}
    >
      {!settings.onboarded && (
        <IntroOverlay onStart={() => updateSettings({ onboarded: true })} />
      )}

      {/* 挨拶：時刻に応じた静かな一言 */}
      <header className="pt-2">
        <p className="text-[13px] font-medium tracking-[0.02em] text-foreground/50">
          {greet ?? "\u00A0"}
        </p>
      </header>

      {/* 主役：実物のモノ。モノモンは端からそっと覗く */}
      <main className="flex flex-1 flex-col items-center justify-center pt-4">
        <HeroCard companion={companion} />

        {/* 詩：短く、余韻を残す */}
        <p className="mt-9 min-h-[3.5rem] max-w-[19rem] whitespace-pre-line text-center text-[15px] font-medium leading-[2] tracking-[0.02em] text-foreground/70">
          {line ?? "\u00A0"}
        </p>
      </main>

      {/* 静かな CTA */}
      <div className="pb-4 pt-2">
        <Link
          to="/scan"
          onClick={() => trackFindClick()}
          className="flex w-full items-center justify-center rounded-full bg-[#3d2f24] py-[18px] text-[15px] font-semibold tracking-[0.14em] text-[#FAF8F3] shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] transition-transform duration-500 active:scale-[0.985]"
        >
          探してみる
        </Link>
      </div>

      {/* 昨日の出会い：小さな余韻。実物写真だけ */}
      {latest && (
        <Link
          to="/zukan"
          className="mx-auto mt-1 flex items-center gap-3 rounded-2xl px-2 py-2 transition-opacity active:opacity-70"
        >
          <div
            className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-white/60"
            style={{ boxShadow: "0 4px 14px -6px rgba(60,45,25,0.28)" }}
          >
            {latest.photo ? (
              <img src={latest.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <MonomonArt monomon={latest} />
            )}
          </div>
          <div className="text-left">
            <p className="text-[10.5px] font-medium tracking-[0.12em] text-foreground/40">
              きのうの出会い
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-foreground/70">
              {latest.objectLabel || FAMILY_STYLES[latest.family].label}
            </p>
          </div>
        </Link>
      )}

      <BottomNav />
    </div>
  );
}

/**
 * ヒーロー：実物のモノを大きく、モノモンは端から静かに覗くだけ。
 * - 相棒がいる → その子の実物写真を大きく + 小さな SVG が右下から覗く
 * - まだいない → 手描きイラスト（マグに宿る精霊）
 * 決して中央にキャラを鎮座させない（マスコット化しない）。
 */
function HeroCard({ companion }: { companion: Monomon | undefined }) {
  if (!companion) {
    return (
      <div className="relative w-[16rem] sm:w-[17.5rem]">
        {/* やわらかい光の輪 */}
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
    );
  }

  // 相棒あり：実物写真が主役。モノモンは右下からそっと覗く小さな存在
  return (
    <div className="relative">
      {/* 光の輪 */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[40px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(210,180,130,0.20), rgba(210,180,130,0) 72%)",
        }}
      />
      <div className="animate-idle-breathe">
        <div
          className="relative h-64 w-64 overflow-hidden rounded-[32px] sm:h-72 sm:w-72"
          style={{ boxShadow: "0 24px 44px -20px rgba(60,45,25,0.34)" }}
        >
          {companion.photo ? (
            <img
              src={companion.photo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-white/60" />
          )}
          {/* ふわっと重なる光 */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,240,210,0.10) 0%, rgba(255,240,210,0) 40%, rgba(90,65,35,0.10) 100%)",
            }}
          />
        </div>
      </div>

      {/* モノモンは端から覗く（マスコット化しない） */}
      <div className="pointer-events-none absolute -bottom-3 -right-2 h-24 w-24 sm:h-28 sm:w-28">
        <div className="animate-idle-gaze h-full w-full drop-shadow-[0_10px_18px_rgba(60,45,25,0.30)]">
          <MonomonArt monomon={companion} />
        </div>
      </div>
    </div>
  );
}
