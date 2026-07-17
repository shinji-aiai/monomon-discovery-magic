import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MonomonArt } from "@/components/MonomonArt";
import { BottomNav } from "@/components/BottomNav";
import { useSettings, updateSettings } from "@/lib/settings";
import { useDex } from "@/lib/dex";
import { trackFindClick } from "@/lib/analytics";
import { SPECIES } from "@/lib/species";
import { FAMILY_STYLES } from "@/lib/monomon-data";
import type { Monomon } from "@/lib/monomon";

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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "こんばんは";
  if (h < 11) return "おはようございます";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

/** その日のモノ（相棒）を主役にした一文。句点なしのやわらかい語り。 */
const AMBIENT_MESSAGES = [
  "今日は窓辺が\nすこし嬉しそうです",
  "今日は本棚のあたりが\n落ち着いています",
  "今日は机の上が\nあたたかい気配です",
  "今日は植物のそばが\nすこし賑やかです",
  "今日はカップから\n優しい気配がします",
];

function messageForCompanion(m: Monomon | undefined): string {
  if (!m) {
    const day = Math.floor(Date.now() / 86_400_000);
    return AMBIENT_MESSAGES[day % AMBIENT_MESSAGES.length];
  }
  const noun = m.objectLabel?.trim() || FAMILY_STYLES[m.family].label;
  const templates = [
    `今日は${noun}から\n優しい気配がします`,
    `今日は${noun}が\nすこし嬉しそうです`,
    `今日は${noun}のそばが\n落ち着くみたいです`,
    `今日は${noun}が\n静かに息をしています`,
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
  // 昨日の出会い＝直近の1件（厳密な昨日ではなく「一番最近の思い出」）
  const latest = useMemo(() => dex[0], [dex]);

  const [heroSeed, setHeroSeed] = useState(0);
  const [heroSpecies, setHeroSpecies] = useState<string | null>(null);
  const [greet, setGreet] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHeroSeed(Math.floor(Math.random() * 1_000_000));
    setHeroSpecies(SPECIES[Math.floor(Math.random() * SPECIES.length)].id);
    setGreet(greeting());
    setMessage(messageForCompanion(companion));
  }, [companion]);

  return (
    <div
      className="relative flex min-h-[100svh] flex-col px-8 pb-32 pt-[max(1.75rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: "#FAF8F3" }}
    >
      {!settings.onboarded && (
        <IntroOverlay onStart={() => updateSettings({ onboarded: true })} />
      )}

      {/* Header — 時刻に応じた静かな挨拶 */}
      <header className="pt-2">
        <p className="text-[13px] font-medium tracking-[0.02em] text-foreground/55">
          {greet ?? "\u00A0"}
        </p>
      </header>

      {/* Main — モノは主役ではない。相棒はそっと佇む */}
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-6 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(210,180,130,0.14), rgba(210,180,130,0) 70%)",
            }}
          />
          {/* 呼吸 → 見回し → 姿。ふわっと生きている感じを重ねる */}
          <div className="animate-idle-breathe">
            <div className="animate-idle-gaze">
              <div className="h-52 w-52 sm:h-60 sm:w-60">
                {companion ? (
                  <MonomonArt monomon={companion} />
                ) : heroSpecies ? (
                  <MonomonArt seed={heroSeed} speciesId={heroSpecies} />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* 実物（モノ）を主語にした一文 */}
        <p className="mt-8 min-h-[3rem] max-w-[18rem] whitespace-pre-line text-center text-[15px] font-medium leading-[1.9] text-foreground/70">
          {message ?? "\u00A0"}
        </p>
      </main>

      {/* Primary action */}
      <div className="pb-4">
        <Link
          to="/scan"
          onClick={() => trackFindClick()}
          className="flex w-full items-center justify-center rounded-full bg-foreground py-[18px] text-[16px] font-bold tracking-[0.08em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] transition-transform duration-200 active:scale-[0.985]"
        >
          探してみる
        </Link>
      </div>

      {/* 昨日の出会い — 一枚だけ、静かに */}
      {latest && (
        <Link
          to="/zukan"
          className="mx-auto flex items-center gap-3 rounded-2xl px-2 py-2 transition-opacity active:opacity-70"
        >
          <div
            className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-white/60"
            style={{
              boxShadow: "0 4px 12px -6px rgba(60,45,25,0.2)",
            }}
          >
            {latest.photo ? (
              <img
                src={latest.photo}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <MonomonArt monomon={latest} />
            )}
          </div>
          <div className="text-left">
            <p className="text-[11px] font-medium tracking-[0.08em] text-foreground/45">
              昨日の出会い
            </p>
            <p className="text-[13px] font-medium text-foreground/70">
              {latest.objectLabel || FAMILY_STYLES[latest.family].label}
            </p>
          </div>
        </Link>
      )}

      <BottomNav />
    </div>
  );
}
