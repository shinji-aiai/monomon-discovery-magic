import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookHeart, Settings as SettingsIcon, Camera, Sparkles } from "lucide-react";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MonomonArt } from "@/components/MonomonArt";
import { useSettings, updateSettings } from "@/lib/settings";
import { useDex } from "@/lib/dex";
import { CATEGORIES } from "@/lib/monomon-data";
import { tap } from "@/lib/sound";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "モノモン｜モノに宿る、小さな精霊たち" },
      {
        name: "description",
        content:
          "身の回りのモノを撮ると、そのモノに宿る小さな精霊が見つかります。さあ、次は何を撮ってみよう？",
      },
      { property: "og:title", content: "モノモン｜モノに宿る、小さな精霊たち" },
      {
        property: "og:description",
        content: "写真を撮ると、モノに宿る小さな精霊が見つかります。",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const settings = useSettings();
  const dex = useDex();
  const [heroSeed, setHeroSeed] = useState(123456);
  const [heroCat, setHeroCat] = useState(CATEGORIES[5]);

  useEffect(() => {
    setHeroSeed(Math.floor(Math.random() * 1_000_000));
    setHeroCat(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
  }, []);

  return (
    <div className="relative flex min-h-[100svh] flex-col gradient-sky px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      {!settings.onboarded && (
        <IntroOverlay onStart={() => updateSettings({ onboarded: true })} />
      )}

      {/* 装飾の星 */}
      <Sparkles className="absolute left-8 top-24 h-5 w-5 text-accent/70 animate-twinkle" />
      <Sparkles
        className="absolute right-10 top-40 h-6 w-6 text-primary/50 animate-twinkle"
        style={{ animationDelay: "0.8s" }}
      />
      <Sparkles
        className="absolute bottom-44 left-12 h-4 w-4 text-accent/60 animate-twinkle"
        style={{ animationDelay: "1.4s" }}
      />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* ヒーロー精霊 */}
        <div className="relative mb-2 h-56 w-56">
          <span className="absolute inset-6 rounded-full bg-primary/15 animate-pulse-ring" />
          <div className="relative h-full w-full animate-float-soft drop-shadow-[0_18px_28px_rgba(120,80,50,0.18)]">
            <MonomonArt seed={heroSeed} category={heroCat} />
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          モノモン
        </h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          モノに宿る、小さな精霊たち
        </p>
      </div>

      {/* アクション */}
      <div className="mx-auto w-full max-w-sm">
        <Link
          to="/scan"
          onClick={tap}
          className="flex w-full items-center justify-center gap-3 rounded-full gradient-primary py-5 text-xl font-extrabold text-primary-foreground shadow-float transition-transform active:scale-95"
        >
          <Camera className="h-6 w-6" />
          見つける
        </Link>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/zukan"
            onClick={tap}
            className="flex items-center justify-center gap-2 rounded-full bg-card/80 py-3.5 text-sm font-bold text-foreground shadow-soft backdrop-blur active:scale-95"
          >
            <BookHeart className="h-5 w-5 text-primary" />
            図鑑
            {dex.length > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                {dex.length}
              </span>
            )}
          </Link>
          <Link
            to="/settings"
            onClick={tap}
            className="flex items-center justify-center gap-2 rounded-full bg-card/80 py-3.5 text-sm font-bold text-foreground shadow-soft backdrop-blur active:scale-95"
          >
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            設定
          </Link>
        </div>
      </div>
    </div>
  );
}
