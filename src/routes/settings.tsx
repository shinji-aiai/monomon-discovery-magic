import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  BookOpen,
  Mail,
  Shield,
  FileText,
  Heart,
  ChevronRight,
  X,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { SupportModal } from "@/components/SupportModal";
import { tap } from "@/lib/sound";

const APP_VERSION = "1.0.0";
const CONTACT_EMAIL = "hello@monomon.app";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "設定｜モノモン" },
      { name: "description", content: "モノモンの設定" },
    ],
  }),
  component: SettingsPage,
});

type Panel = "about" | "howto" | "contact" | "privacy" | "terms" | null;

function SettingsPage() {
  const [panel, setPanel] = useState<Panel>(null);
  const [support, setSupport] = useState(false);

  const open = (p: Exclude<Panel, null>) => {
    tap();
    setPanel(p);
  };

  return (
    <div className="min-h-[100svh] gradient-sky px-5 pb-28 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-foreground">設定</h1>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <CardRow
          icon={<Sparkles className="h-6 w-6 text-primary" />}
          label="アプリについて"
          onClick={() => open("about")}
        />
        <CardRow
          icon={<BookOpen className="h-6 w-6 text-primary" />}
          label="遊び方"
          onClick={() => open("howto")}
        />
        <CardRow
          icon={<Mail className="h-6 w-6 text-primary" />}
          label="お問い合わせ"
          onClick={() => open("contact")}
        />
        <CardRow
          icon={<Shield className="h-6 w-6 text-primary" />}
          label="プライバシーポリシー"
          onClick={() => open("privacy")}
        />
        <CardRow
          icon={<FileText className="h-6 w-6 text-primary" />}
          label="利用規約"
          onClick={() => open("terms")}
        />

        <button
          onClick={() => {
            tap();
            setSupport(true);
          }}
          className="flex w-full items-center gap-4 rounded-3xl bg-card px-5 py-5 text-left shadow-soft active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100">
            <Heart className="h-6 w-6 fill-rose-400 text-rose-400" />
          </span>
          <span className="flex-1 text-[1.05rem] font-bold text-foreground">
            応援する ❤️
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>

        <p className="pt-4 text-center text-xs text-muted-foreground">
          モノモン　バージョン {APP_VERSION}
        </p>
      </div>

      {panel && <InfoPanel panel={panel} onClose={() => setPanel(null)} />}
      {support && <SupportModal onClose={() => setSupport(false)} />}

      <BottomNav />
    </div>
  );
}

function CardRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-3xl bg-card px-5 py-5 text-left shadow-soft active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
        {icon}
      </span>
      <span className="flex-1 text-[1.05rem] font-bold text-foreground">
        {label}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

const PANEL_TITLE: Record<Exclude<Panel, null>, string> = {
  about: "アプリについて",
  howto: "遊び方",
  contact: "お問い合わせ",
  privacy: "プライバシーポリシー",
  terms: "利用規約",
};

function InfoPanel({
  panel,
  onClose,
}: {
  panel: Exclude<Panel, null>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[80svh] w-full max-w-md animate-rise-in overflow-y-auto rounded-t-3xl bg-background p-6 pb-10 shadow-float sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {PANEL_TITLE[panel]}
          </h2>
          <button
            onClick={() => {
              tap();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {panel === "about" && (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <div className="flex flex-col items-center text-center">
              <div className="text-5xl">✨</div>
              <p className="mt-3 text-lg font-extrabold text-foreground">
                モノモン
              </p>
              <p className="text-xs">モノに宿る小さな精霊たち</p>
              <p className="mt-1 text-xs">バージョン {APP_VERSION}</p>
            </div>
            <p>身の回りのモノを撮るとそのモノに宿る小さな精霊が見つかる</p>
            <p>お気に入りのモノモンを見つけて図鑑を埋めていってね</p>
          </div>
        )}

        {panel === "howto" && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>身近なモノを撮ってみよう</p>
            <p>そのモノに宿るモノモンが見つかるよ</p>
            <p>見つけたモノモンは図鑑に集まっていくよ</p>
            <p>いろんなモノを撮って図鑑を埋めよう</p>
          </div>
        )}

        {panel === "contact" && (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>ご感想やご要望はいつでも気軽に送ってね　みなさまの声が次のモノモンをつくるよ</p>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                "モノモンへのお問い合わせ",
              )}`}
              onClick={tap}
              className="flex w-full items-center justify-center gap-2 rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
            >
              <Mail className="h-5 w-5" />
              メールで問い合わせる
            </a>
            <p className="text-center text-xs">{CONTACT_EMAIL}</p>
          </div>
        )}

        {panel === "privacy" && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>モノモンはあなたのプライバシーを大切にするよ</p>
            <p>
              撮った写真と見つけたモノモンのデータはすべてお使いの端末の中だけに保存される
            </p>
            <p>外部のサーバーに送られることはないよ</p>
            <p>このアプリは広告やトラッキングをしないよ</p>
            <p>
              「応援する」を使うときだけ決済に必要な情報が決済事業者へ送られる
            </p>
          </div>
        )}

        {panel === "terms" && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>この利用規約はモノモンの使い方の条件を定めたもの</p>
            <p>本アプリを使った時点でこの規約に同意したものとみなすよ</p>
            <p>
              本アプリで生まれるモノモンは撮った写真をもとに自動でつくられるオリジナルのキャラクター
            </p>
            <p>個人で自由に楽しんでね</p>
            <p>
              他の人の権利を傷つける写真や公序良俗に反する写真の利用はご遠慮ください
            </p>
            <p>この規約は予告なく変わることがあるよ</p>
          </div>
        )}
      </div>
    </div>
  );
}
