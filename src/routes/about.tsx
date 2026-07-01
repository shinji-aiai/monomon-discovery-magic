import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Shield, FileText, ChevronRight, Sparkles, Apple } from "lucide-react";
import { MonomonArt } from "@/components/MonomonArt";
import { tap } from "@/lib/sound";
import {
  APP_VERSION_LABEL,
  CONTACT_EMAIL,
  APP_STORE_URL,
} from "@/lib/app-info";

const SITE_URL = "https://monomon-discovery-magic.lovable.app/about";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "モノモン公式サイト｜日常に宿る小さな精霊との出会い" },
      {
        name: "description",
        content:
          "モノモンは身近なモノを撮影すると小さな精霊「モノモン」と出会えるコレクションゲーム　お問い合わせ・プライバシーポリシー・利用規約はこちら",
      },
      { property: "og:title", content: "モノモン公式サイト" },
      {
        property: "og:description",
        content: "日常に宿る小さな精霊との出会い",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const storeReady = APP_STORE_URL.trim().length > 0;

  return (
    <div className="min-h-[100svh] gradient-sky">
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pb-20 pt-[max(4rem,env(safe-area-inset-top))] text-center">
        {/* ① ロゴ */}
        <div className="relative h-32 w-32">
          <Sparkles className="absolute -left-3 top-2 h-4 w-4 text-accent/60 animate-twinkle" />
          <Sparkles
            className="absolute -right-2 top-6 h-5 w-5 text-primary/40 animate-twinkle"
            style={{ animationDelay: "0.8s" }}
          />
          <Sparkles
            className="absolute bottom-1 left-4 h-3 w-3 text-accent/50 animate-twinkle"
            style={{ animationDelay: "1.4s" }}
          />
          <div className="h-full w-full animate-float-soft drop-shadow-[0_18px_28px_rgba(120,80,50,0.22)]">
            <MonomonArt seed={123456} />
          </div>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground">
          モノモン
        </h1>

        {/* ② キャッチコピー */}
        <p className="mt-3 text-[1.05rem] font-bold leading-relaxed text-muted-foreground">
          日常に宿る
          <br className="sm:hidden" />
          小さな精霊との出会い
        </p>

        {/* ③ アプリ紹介 */}
        <p className="mt-10 text-[0.95rem] leading-loose text-muted-foreground">
          モノモンは
          <br />
          身近なモノを撮影すると
          <br />
          小さな精霊「モノモン」と出会える
          <br />
          コレクションゲームです
        </p>

        {/* ④ App Store */}
        <div className="mt-12 w-full">
          {storeReady ? (
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={tap}
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-foreground py-4 text-sm font-extrabold text-background shadow-float active:scale-95"
            >
              <Apple className="h-5 w-5" />
              App Store で手に入れる
            </a>
          ) : (
            <div className="flex w-full flex-col items-center gap-2 rounded-full border border-dashed border-border bg-card/60 py-4 text-sm font-bold text-muted-foreground">
              <span className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                App Store は近日公開
              </span>
            </div>
          )}
        </div>

        {/* 区切り */}
        <div className="my-14 flex items-center gap-2 text-muted-foreground/50">
          <Sparkles className="h-3.5 w-3.5" />
          <Sparkles className="h-4 w-4" />
          <Sparkles className="h-3.5 w-3.5" />
        </div>

        {/* ⑤ お問い合わせ */}
        <div className="w-full">
          <p className="mb-3 text-left text-xs font-bold text-muted-foreground">
            お問い合わせ
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "モノモンへのお問い合わせ",
            )}`}
            onClick={tap}
            className="flex w-full items-center justify-center gap-2 rounded-full gradient-primary py-4 text-sm font-extrabold text-primary-foreground shadow-float active:scale-95"
          >
            <Mail className="h-5 w-5" />
            メールで問い合わせる
          </a>
          <p className="mt-3 text-xs text-muted-foreground">{CONTACT_EMAIL}</p>
        </div>

        {/* ⑥⑦ プライバシー・利用規約 */}
        <div className="mt-10 flex w-full flex-col gap-4">
          <Link
            to="/settings"
            search={{ panel: "privacy" }}
            onClick={tap}
            className="flex w-full items-center gap-4 rounded-3xl bg-card px-5 py-5 text-left shadow-soft active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </span>
            <span className="flex-1 text-[1rem] font-bold text-foreground">
              プライバシーポリシー
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>

          <Link
            to="/settings"
            search={{ panel: "terms" }}
            onClick={tap}
            className="flex w-full items-center gap-4 rounded-3xl bg-card px-5 py-5 text-left shadow-soft active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </span>
            <span className="flex-1 text-[1rem] font-bold text-foreground">
              利用規約
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </div>

        {/* ⑧ バージョン & フッター */}
        <p className="mt-16 text-xs font-bold text-muted-foreground">
          モノモン　{APP_VERSION_LABEL}
        </p>
        <p className="mt-2 text-[0.7rem] text-muted-foreground/70">
          © モノモン
        </p>
      </div>
    </div>
  );
}
