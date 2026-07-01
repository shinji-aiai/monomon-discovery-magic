import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, Sparkles, ChevronRight } from "lucide-react";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MonomonArt } from "@/components/MonomonArt";
import { BottomNav } from "@/components/BottomNav";
import { SupportButton } from "@/components/SupportButton";
import { useSettings, updateSettings } from "@/lib/settings";
import { useDex, countToday } from "@/lib/dex";
import { trackFindClick } from "@/lib/analytics";
import { FAMILY_STYLES } from "@/lib/monomon-data";
import { SPECIES, SPECIES_COUNT, getSpecies } from "@/lib/species";

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

/** 毎日そっと変わる、探索へ誘う一言。 */
const DAILY_MESSAGES = [
  "今日は何を発見できるかな",
  "まだ見ぬモノモンが待っているよ",
  "身近なモノを見つめてみよう",
  "小さな出会いが待っているかも",
  "モノモンは今日もどこかで眠っている",
  "ふと目にとまるモノに宿っているかも",
  "今日の一体に会いにいこう",
];

/** さいきんの相棒がホームで迎えてくれる一言。 */
const COMPANION_GREETINGS = [
  "また会えてうれしい",
  "今日も元気だよ",
  "おかえり",
  "会いたかったよ",
  "そばにいるね",
  "きょうもよろしくね",
];

/** 端末ローカルの「日」でインデックスを決める（毎日変わる・その日は一定）。 */
function pickByDay<T>(arr: T[], offset = 0): T {
  const day = Math.floor(Date.now() / 86_400_000) + offset;
  return arr[((day % arr.length) + arr.length) % arr.length];
}


function Home() {
  const settings = useSettings();
  const dex = useDex();
  const last = dex[0];
  const today = countToday(dex);
  const kinds = useMemo(() => new Set(dex.map((m) => m.speciesId)).size, [dex]);

  const [heroSeed, setHeroSeed] = useState(123456);
  const [heroSpecies, setHeroSpecies] = useState(SPECIES[0].id);
  // 時刻依存のあいさつは、SSRとクライアントの初回描画を一致させるため
  // マウント後にだけ確定させる（LINE等のWebViewでの hydration 不一致を防ぐ）。
  const [greet, setGreet] = useState<string | null>(null);
  const [daily, setDaily] = useState<string | null>(null);
  const [companion, setCompanion] = useState<string | null>(null);
  useEffect(() => {
    setHeroSeed(Math.floor(Math.random() * 1_000_000));
    setHeroSpecies(SPECIES[Math.floor(Math.random() * SPECIES.length)].id);
    setGreet(greeting());
    setDaily(pickByDay(DAILY_MESSAGES));
    setCompanion(pickByDay(COMPANION_GREETINGS));
  }, []);

  return (
    <div className="relative flex min-h-[100svh] flex-col gradient-sky px-6 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      {!settings.onboarded && (
        <IntroOverlay onStart={() => updateSettings({ onboarded: true })} />
      )}

      <Sparkles className="absolute left-6 top-20 h-4 w-4 text-accent/60 animate-twinkle" />
      <Sparkles
        className="absolute right-8 top-32 h-5 w-5 text-primary/40 animate-twinkle"
        style={{ animationDelay: "0.8s" }}
      />

      {/* あいさつ */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{greet ?? "ようこそ"}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            モノモン
          </h1>
        </div>
        <span className="rounded-full bg-card/70 px-3 py-1 text-xs font-bold text-muted-foreground backdrop-blur">
          モノに宿る小さな精霊
        </span>
      </div>

      {/* ヒーロー（さいきん見つけた子 or これから） */}
      <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
        {/* さいきんの相棒がホームで迎える一言 */}
        {last && companion && (
          <div className="relative mb-3 animate-pop-in rounded-full bg-card px-4 py-1.5 text-sm font-bold text-card-foreground shadow-soft">
            「{companion}」
            <span className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-card" />
          </div>
        )}
        <div className="relative h-44 w-44">
          <span className="absolute inset-5 rounded-full bg-primary/15 animate-pulse-ring" />
          <div className="relative h-full w-full animate-float-soft drop-shadow-[0_16px_24px_rgba(120,80,50,0.2)]">
            {last ? (
              <MonomonArt monomon={last} />
            ) : (
              <MonomonArt seed={heroSeed} speciesId={heroSpecies} />
            )}
          </div>
        </div>
        {last ? (
          <p className="mt-1 text-sm font-bold text-foreground">
            さいきんの相棒「{last.name}」
            <span className="ml-1 font-medium text-muted-foreground">
              · {getSpecies(last.speciesId).emoji} {getSpecies(last.speciesId).name}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            さあ最初の精霊を見つけよう
          </p>
        )}
      </div>


      {/* 統計：個体数・種族数 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="きょう" value={today} unit="匹" accent />
        <Stat label="個体" value={dex.length} unit="匹" />
        <Stat label="種族" value={`${kinds}/${SPECIES_COUNT}`} unit="種" />
      </div>

      {/* さいきん見つけた一覧 */}
      {dex.length > 0 && (
        <Link
          to="/zukan"
          className="mb-4 flex items-center gap-3 rounded-3xl bg-card/80 p-3 shadow-soft backdrop-blur active:scale-[0.98]"
        >
          <div className="flex -space-x-3">
            {dex.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="h-11 w-11 overflow-hidden rounded-full border-2 border-card"
                style={{
                  backgroundImage: `linear-gradient(160deg, ${FAMILY_STYLES[m.family].bg[0]}, ${FAMILY_STYLES[m.family].bg[1]})`,
                }}
              >
                <MonomonArt monomon={m} />
              </div>
            ))}
          </div>
          <span className="flex-1 text-sm font-bold text-foreground">
            図鑑を見る
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}

      {/* メインアクション */}
      <Link
        to="/scan"
        onClick={() => trackFindClick()}
        className="flex w-full items-center justify-center gap-3 rounded-full gradient-primary py-5 text-xl font-extrabold text-primary-foreground shadow-float transition-transform active:scale-95"
      >
        <Camera className="h-6 w-6" />
        見つける
      </Link>

      {/* 応援（ホーム下部・小さめカード） */}
      <SupportButton variant="home" />

      <BottomNav />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number | string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-3 text-center shadow-soft ${
        accent ? "gradient-magic text-card" : "bg-card/85 backdrop-blur"
      }`}
    >
      <p
        className={`text-[0.7rem] font-bold ${accent ? "text-card/80" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 text-2xl font-extrabold leading-none ${accent ? "text-card" : "text-foreground"}`}
      >
        {value}
        <span className="ml-0.5 text-xs font-bold">{unit}</span>
      </p>
    </div>
  );
}
