import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MonomonArt } from "@/components/MonomonArt";
import { BottomNav } from "@/components/BottomNav";
import { useSettings, updateSettings } from "@/lib/settings";
import { useDex } from "@/lib/dex";
import { trackFindClick } from "@/lib/analytics";
import { SPECIES } from "@/lib/species";

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
  if (h < 5) return "Good Evening";
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

/** A single quiet sentence. Rotates by day, chosen after mount to avoid SSR mismatch. */
const QUIET_MESSAGES = [
  "Today seems to enjoy the window.",
  "The mug looks happy today.",
  "It feels like a quiet day.",
  "Someone is watching the clouds.",
  "A soft breeze drifts through.",
  "The little one is listening.",
  "A book nearby is smiling.",
];

// System / Apple-style display stack, falling back to M PLUS Rounded for CJK.
const DISPLAY_FONT =
  '-apple-system, "SF Pro Display", BlinkMacSystemFont, "M PLUS Rounded 1c", system-ui, sans-serif';

function Home() {
  const settings = useSettings();
  const dex = useDex();
  const companion = useMemo(
    () => dex.find((m) => m.favorite) ?? dex[0],
    [dex],
  );

  const [heroSeed, setHeroSeed] = useState(0);
  const [heroSpecies, setHeroSpecies] = useState<string | null>(null);
  const [greet, setGreet] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHeroSeed(Math.floor(Math.random() * 1_000_000));
    setHeroSpecies(SPECIES[Math.floor(Math.random() * SPECIES.length)].id);
    setGreet(greeting());
    const dayIdx = Math.floor(Date.now() / 86_400_000) % QUIET_MESSAGES.length;
    setMessage(QUIET_MESSAGES[dayIdx]);
  }, []);

  return (
    <div
      className="relative flex min-h-[100svh] flex-col px-8 pb-32 pt-[max(1.75rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: "#FAF8F3" }}
    >
      {!settings.onboarded && (
        <IntroOverlay onStart={() => updateSettings({ onboarded: true })} />
      )}

      {/* Header — very subtle */}
      <header className="pt-2">
        <p
          className="text-[13px] font-normal tracking-[0.02em] text-foreground/55"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          {greet ?? "\u00A0"}
        </p>
      </header>

      {/* Main character — centered, alive */}
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="relative">
          {/* Very soft ambient glow — barely there */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-6 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(210,180,130,0.14), rgba(210,180,130,0) 70%)",
            }}
          />
          {/* Breathing → gaze → art. Nested so animations compose. */}
          <div className="animate-idle-breathe">
            <div className="animate-idle-gaze">
              <div className="h-56 w-56 sm:h-64 sm:w-64">
                {companion ? (
                  <MonomonArt monomon={companion} />
                ) : heroSpecies ? (
                  <MonomonArt seed={heroSeed} speciesId={heroSpecies} />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* One quiet sentence */}
        <p
          className="mt-10 max-w-[18rem] text-center text-[15px] font-normal leading-relaxed text-foreground/70"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          {message ?? "\u00A0"}
        </p>
      </main>

      {/* Primary action */}
      <div className="pb-2">
        <Link
          to="/scan"
          onClick={() => trackFindClick()}
          className="flex w-full items-center justify-center rounded-full bg-foreground py-[18px] text-[17px] font-medium tracking-[0.01em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] transition-transform duration-200 active:scale-[0.985]"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          Meet
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
