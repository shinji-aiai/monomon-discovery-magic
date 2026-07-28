import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, Bell, ChevronRight } from "lucide-react";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MonomonArt } from "@/components/MonomonArt";
import { StoredImmersionVisual } from "@/components/StoredImmersionVisual";
import { BottomNav } from "@/components/BottomNav";
import { SupportButton } from "@/components/SupportButton";
import { useSettings, updateSettings } from "@/lib/settings";
import { useDex } from "@/lib/dex";
import { trackFindClick } from "@/lib/analytics";
import { SPECIES, getSpecies } from "@/lib/species";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "モノモン｜モノに宿る小さな精霊たち" },
      {
        name: "description",
        content:
          "身の回りのモノを撮るとそのモノに宿る小さな精霊が見つかる　さあ次は何を撮ってみよう",
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

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "こんばんは";
  if (h < 11) return "おはよう";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

const COMPANION_GREETINGS = [
  "きょうも みつけてくれて ありがとう",
  "また 会えて うれしい",
  "そばに いるね",
  "きょうも よろしくね",
];

function pickByDay<T>(arr: T[], offset = 0): T {
  const day = Math.floor(Date.now() / 86_400_000) + offset;
  return arr[((day % arr.length) + arr.length) % arr.length];
}

function Home() {
  const settings = useSettings();
  const dex = useDex();

  // ホームで「暮らしている」相棒たち：お気に入り優先、最大3体
  const roommates = useMemo(() => {
    const favs = dex.filter((m) => m.favorite);
    const rest = dex.filter((m) => !m.favorite);
    return [...favs, ...rest].slice(0, 3);
  }, [dex]);
  const primary = roommates[0];

  const [heroSeed, setHeroSeed] = useState(123456);
  const [heroSpecies, setHeroSpecies] = useState(SPECIES[0].id);
  const [greet, setGreet] = useState<string | null>(null);
  const [companion, setCompanion] = useState<string | null>(null);

  useEffect(() => {
    setHeroSeed(Math.floor(Math.random() * 1_000_000));
    setHeroSpecies(SPECIES[Math.floor(Math.random() * SPECIES.length)].id);
    setGreet(greeting());
    setCompanion(pickByDay(COMPANION_GREETINGS));
  }, []);

  const albumPreview = dex.slice(0, 4);

  return (
    <div className="relative flex min-h-[100svh] flex-col bg-day-room px-6 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {!settings.onboarded && (
        <IntroOverlay onStart={() => updateSettings({ onboarded: true })} />
      )}

      {/* ふわりと差す自然光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70"
        style={{
          background:
            "radial-gradient(90% 60% at 80% 0%, oklch(0.98 0.06 80 / 0.85), transparent 60%)",
        }}
      />

      {/* あいさつ */}
      <header className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-muted-foreground">{greet ?? "ようこそ"}</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-foreground">
            モノモン
          </h1>
        </div>
        <Link
          to="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full glass-day shadow-soft text-foreground/70 active:scale-95"
          aria-label="お知らせ"
        >
          <Bell className="h-4 w-4" />
        </Link>
      </header>

      {/* 相棒からの一言（吹き出し） */}
      <div className="relative mt-6 flex justify-center">
        {(companion || !primary) && (
          <div className="relative animate-rise-in rounded-3xl glass-day px-5 py-3 text-center text-[13px] font-bold leading-relaxed text-foreground shadow-soft">
            {primary
              ? (companion ?? "きょうも ありがとう")
                  .split(" ")
                  .map((w, i) => <span key={i} className="mr-0.5">{w}</span>)
              : "きょうも みつけてくれて ありがとう"}
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 glass-day border-none" />
          </div>
        )}
      </div>

      {/* 生活空間：モノモンたちが暮らす棚 */}
      <div className="relative mt-6 flex flex-1 items-end justify-center">
        {/* 木の机の暖かな面 */}
        <div
          aria-hidden
          className="absolute inset-x-[-1.5rem] bottom-[6.5rem] h-40 rounded-t-[3rem]"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.88 0.05 55 / 0) 0%, oklch(0.82 0.06 45 / 0.55) 55%, oklch(0.72 0.08 40 / 0.7) 100%)",
          }}
        />
        {/* 遠くにぼんやり並ぶ植物と本 */}
        <div
          aria-hidden
          className="absolute right-0 top-4 h-40 w-28 rounded-full opacity-40 blur-2xl"
          style={{ background: "oklch(0.75 0.14 145)" }}
        />
        <div
          aria-hidden
          className="absolute left-0 top-16 h-32 w-24 rounded-2xl opacity-30 blur-xl"
          style={{ background: "oklch(0.65 0.09 40)" }}
        />

        {/* モノモンたちの配置（メイン中央・脇に小さな仲間） */}
        <div className="relative flex w-full items-end justify-center gap-4 pb-24">
          {roommates[1] && (
            <RoomMonomon size={72} lift={16} monomon={roommates[1]} />
          )}
          <RoomMonomon
            size={160}
            main
            monomon={primary}
            fallbackSeed={heroSeed}
            fallbackSpecies={heroSpecies}
          />
          {roommates[2] && (
            <RoomMonomon size={64} lift={22} monomon={roommates[2]} />
          )}
        </div>
      </div>

      {/* 発見アルバムへの導線＋撮影CTA */}
      <div className="relative">
        {dex.length > 0 && (
          <Link
            to="/zukan"
            className="mb-4 flex items-center gap-3 rounded-[24px] glass-day px-4 py-3 shadow-soft active:scale-[0.98]"
          >
            <span className="text-xs font-extrabold text-foreground/70">
              きょうの発見アルバム
            </span>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.66rem] font-extrabold text-primary">
              {dex.length}匹
            </span>
            <div className="ml-auto flex -space-x-2">
              {albumPreview.map((m) => (
                <div
                  key={m.id}
                  className="h-9 w-9 overflow-hidden rounded-full border-2 border-white/80 bg-white/60"
                >
                  {m.immersionImageId ? (
                    <StoredImmersionVisual
                      monomon={m}
                      alt={m.name}
                      lazy
                      fallback={<MonomonArt monomon={m} />}
                    />
                  ) : (
                    <MonomonArt monomon={m} />
                  )}
                </div>
              ))}
            </div>
            <ChevronRight className="h-4 w-4 text-foreground/50" />
          </Link>
        )}

        {/* 中央に浮かぶ大きな撮影ボタン */}
        <div className="relative flex flex-col items-center">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-2 h-24 w-24 rounded-full opacity-70 blur-2xl warm-glow animate-breathe"
          />
          <Link
            to="/scan"
            onClick={() => trackFindClick()}
            className="relative flex h-20 w-20 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-float transition-transform active:scale-95"
            aria-label="さがしにいく"
          >
            <Camera className="h-8 w-8" strokeWidth={2.2} />
          </Link>
          <span className="mt-2 text-[11px] font-extrabold tracking-wide text-foreground/80">
            さがしにいく
          </span>
        </div>
      </div>

      <SupportButton variant="home" />

      <BottomNav variant="day" />
    </div>
  );
}

/** 部屋の中に「暮らしている」モノモンひとり分。 */
function RoomMonomon({
  monomon,
  size,
  main,
  lift = 0,
  fallbackSeed,
  fallbackSpecies,
}: {
  monomon?: import("@/lib/monomon").Monomon;
  size: number;
  main?: boolean;
  lift?: number;
  fallbackSeed?: number;
  fallbackSpecies?: string;
}) {
  const label = monomon
    ? `${monomon.name}（${getSpecies(monomon.speciesId).name}）`
    : "モノモン";
  return (
    <div
      className={`relative shrink-0 ${main ? "animate-life-float" : "animate-float-soft"}`}
      style={{ width: size, height: size, marginBottom: lift }}
      aria-label={label}
    >
      {/* 暖かな床の光 */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full warm-glow"
      />
      {/* 床の影 */}
      <span
        aria-hidden
        className="absolute left-1/2 top-full h-2 w-[70%] -translate-x-1/2 -translate-y-1 rounded-full bg-foreground/20 blur-md"
      />
      <div className="relative h-full w-full drop-shadow-[0_10px_18px_rgba(90,60,40,0.28)]">
        {monomon ? (
          monomon.immersionImageId ? (
            <StoredImmersionVisual
              monomon={monomon}
              alt={monomon.name}
              fallback={<MonomonArt monomon={monomon} />}
            />
          ) : (
            <MonomonArt monomon={monomon} />
          )
        ) : (
          <MonomonArt seed={fallbackSeed} speciesId={fallbackSpecies} />
        )}
        {/* ガラスの反射（樹脂・ガラス質感） */}
        <span className="glass-sheen rounded-[35%]" />
      </div>
    </div>
  );
}
