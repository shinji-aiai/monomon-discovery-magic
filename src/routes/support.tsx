import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Shield, FileText, ChevronRight, Sparkles } from "lucide-react";
import { MonomonArt } from "@/components/MonomonArt";
import { tap } from "@/lib/sound";
import { APP_VERSION, CONTACT_EMAIL } from "@/lib/app-info";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "サポート｜モノモン" },
      {
        name: "description",
        content:
          "モノモンのサポートページ　お問い合わせ・プライバシーポリシー・利用規約はこちら",
      },
      { property: "og:title", content: "サポート｜モノモン" },
      {
        property: "og:description",
        content: "モノモンのお問い合わせとサポート情報",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="min-h-[100svh] gradient-sky px-6 pb-16 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        {/* ロゴ */}
        <div className="relative h-28 w-28">
          <Sparkles className="absolute -left-2 top-1 h-4 w-4 text-accent/60 animate-twinkle" />
          <Sparkles
            className="absolute -right-1 top-4 h-5 w-5 text-primary/40 animate-twinkle"
            style={{ animationDelay: "0.8s" }}
          />
          <div className="h-full w-full animate-float-soft drop-shadow-[0_16px_24px_rgba(120,80,50,0.2)]">
            <MonomonArt seed={123456} />
          </div>
        </div>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-foreground">
          モノモン
        </h1>
        <p className="mt-1 text-sm font-bold text-muted-foreground">
          モノに宿る小さな精霊たち
        </p>

        {/* アプリ紹介（短く） */}
        <p className="mt-8 text-[0.95rem] leading-relaxed text-muted-foreground">
          身の回りのモノを撮ると
          <br />
          そのモノに宿る小さな精霊が見つかるよ
          <br />
          お気に入りの子を見つけて図鑑を埋めていってね
        </p>

        {/* お問い合わせ */}
        <div className="mt-12 w-full">
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

        {/* プライバシー・利用規約 */}
        <div className="mt-10 flex w-full flex-col gap-4">
          <Link
            to="/settings"
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

        {/* バージョン */}
        <p className="mt-14 text-xs text-muted-foreground">
          モノモン　バージョン {APP_VERSION}
        </p>
      </div>
    </div>
  );
}
