import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Volume2,
  Music,
  Smartphone,
  Trash2,
  Shield,
  FileText,
  Mail,
  Info,
  Heart,
  ChevronRight,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BottomNav } from "@/components/BottomNav";
import { SupportModal } from "@/components/SupportModal";
import { useSettings, updateSettings } from "@/lib/settings";
import { useDex, clearDex } from "@/lib/dex";
import { tap, playSound, haptic, syncBgm } from "@/lib/sound";

const APP_VERSION = "1.0.0";
const CONTACT_EMAIL = "hello@monomon.app";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "設定｜モノモン" },
      { name: "description", content: "モノモンの設定。" },
    ],
  }),
  component: SettingsPage,
});

type Panel = "privacy" | "terms" | "contact" | "about" | null;

function SettingsPage() {
  const settings = useSettings();
  const dex = useDex();
  const [confirmClear, setConfirmClear] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [support, setSupport] = useState(false);

  const toggleSound = (v: boolean) => {
    updateSettings({ sound: v });
    if (v) playSound("button");
  };
  const toggleBgm = (v: boolean) => {
    updateSettings({ bgm: v });
    syncBgm();
    if (v) haptic(10);
  };
  const toggleHaptics = (v: boolean) => {
    updateSettings({ haptics: v });
    if (v) haptic(20);
  };

  const doClear = () => {
    clearDex();
    setConfirmClear(false);
    haptic(20);
    toast.success("図鑑データを削除しました");
  };

  return (
    <div className="min-h-[100svh] gradient-sky px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground">設定</h1>
      </header>

      <div className="mx-auto w-full max-w-md space-y-6">
        {/* 応援 */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold text-muted-foreground">
            応援
          </h2>
          <button
            onClick={() => {
              tap();
              setSupport(true);
            }}
            className="flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-card px-4 py-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100">
              <Heart className="h-6 w-6 fill-rose-400 text-rose-400" />
            </span>
            <span className="flex-1">
              <span className="block text-[0.98rem] font-bold text-foreground">
                モノモンを応援する
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                新しいモノモンの開発に使わせていただきます。
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        </section>

        {/* 一般 */}
        <Section title="一般">
          <Row icon={<Volume2 className="h-5 w-5 text-primary" />} label="効果音">
            <Switch checked={settings.sound} onCheckedChange={toggleSound} />
          </Row>
          <Divider />
          <Row icon={<Music className="h-5 w-5 text-primary" />} label="BGM">
            <Switch checked={settings.bgm} onCheckedChange={toggleBgm} />
          </Row>
          <Divider />
          <Row
            icon={<Smartphone className="h-5 w-5 text-primary" />}
            label="バイブ"
          >
            <Switch checked={settings.haptics} onCheckedChange={toggleHaptics} />
          </Row>
        </Section>

        {/* データ */}
        <Section title="データ">
          {confirmClear ? (
            <div className="px-4 py-4 text-center">
              <p className="text-sm font-bold text-destructive">
                図鑑のモノモンを すべて削除しますか？
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                この操作は取り消せません（{dex.length}たい）
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    tap();
                    setConfirmClear(false);
                  }}
                  className="rounded-xl bg-muted py-2.5 text-sm font-bold text-foreground active:scale-95"
                >
                  やめる
                </button>
                <button
                  onClick={doClear}
                  className="rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground active:scale-95"
                >
                  削除する
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                tap();
                if (dex.length === 0) {
                  toast("削除するデータがありません");
                  return;
                }
                setConfirmClear(true);
              }}
              className="flex w-full items-center justify-between px-4 py-4 active:bg-muted/50"
            >
              <span className="flex items-center gap-3 text-[0.95rem] font-medium text-destructive">
                <Trash2 className="h-5 w-5" />
                図鑑データを削除
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </Section>

        {/* 情報 */}
        <Section title="情報">
          <NavRow
            icon={<Mail className="h-5 w-5 text-primary" />}
            label="お問い合わせ"
            onClick={() => {
              tap();
              setPanel("contact");
            }}
          />
          <Divider />
          <NavRow
            icon={<FileText className="h-5 w-5 text-primary" />}
            label="利用規約"
            onClick={() => {
              tap();
              setPanel("terms");
            }}
          />
          <Divider />
          <NavRow
            icon={<Shield className="h-5 w-5 text-primary" />}
            label="プライバシーポリシー"
            onClick={() => {
              tap();
              setPanel("privacy");
            }}
          />
          <Divider />
          <NavRow
            icon={<Info className="h-5 w-5 text-primary" />}
            label="アプリ情報"
            onClick={() => {
              tap();
              setPanel("about");
            }}
          />
        </Section>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          モノモン　バージョン {APP_VERSION}
        </p>
      </div>

      {panel && <InfoPanel panel={panel} onClose={() => setPanel(null)} />}
      {support && <SupportModal onClose={() => setSupport(false)} />}

      <BottomNav />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-card shadow-soft">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <span className="flex items-center gap-3 text-[0.98rem] font-medium text-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

function NavRow({
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
      className="flex w-full items-center justify-between px-4 py-4 active:bg-muted/50"
    >
      <span className="flex items-center gap-3 text-[0.98rem] font-medium text-foreground">
        {icon}
        {label}
      </span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

function Divider() {
  return <div className="ml-12 h-px bg-border" />;
}

const PANEL_TITLE: Record<Exclude<Panel, null>, string> = {
  privacy: "プライバシーポリシー",
  terms: "利用規約",
  contact: "お問い合わせ",
  about: "アプリ情報",
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

        {panel === "privacy" && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>モノモンは、あなたのプライバシーを大切にします。</p>
            <p>
              撮影・選択した写真と、見つけたモノモンのデータは、すべてお使いの端末内にのみ保存されます。外部のサーバーに送信されることはありません。
            </p>
            <p>
              図鑑のデータは「設定 → 図鑑データを削除」または端末のデータ消去でいつでも削除できます。
            </p>
            <p>本アプリは、広告・トラッキングを行いません。</p>
            <p>
              「モノモンを応援する」をご利用の場合のみ、決済処理のために必要な情報が決済事業者へ送信されます。
            </p>
          </div>
        )}

        {panel === "terms" && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              本利用規約は、モノモン（以下「本アプリ」）の利用条件を定めるものです。本アプリをご利用いただいた時点で、本規約に同意したものとみなします。
            </p>
            <p>
              本アプリで生成される「モノモン」は、撮影した写真をもとに自動でつくられるオリジナルのキャラクターです。個人で自由にお楽しみいただけます。
            </p>
            <p>
              他者の権利を侵害する写真、公序良俗に反する写真の利用はご遠慮ください。
            </p>
            <p>
              本アプリは現状有姿で提供され、利用により生じた損害について、開発者は責任を負いかねます。
            </p>
            <p>本規約は予告なく変更されることがあります。</p>
          </div>
        )}

        {panel === "contact" && (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              ご感想・ご要望・不具合のご報告など、いつでもお気軽にお寄せください。みなさまの声が、次のモノモンをつくります。
            </p>
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

        {panel === "about" && (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <div className="flex flex-col items-center text-center">
              <div className="text-5xl">✨</div>
              <p className="mt-3 text-lg font-extrabold text-foreground">
                モノモン
              </p>
              <p className="text-xs">モノに宿る、小さな精霊たち</p>
              <p className="mt-1 text-xs">バージョン {APP_VERSION}</p>
            </div>
            <p>
              身の回りのモノを撮ると、そのモノに宿る小さな精霊「モノモン」が見つかります。
            </p>
            <p>
              さあ、次は何を撮ってみよう？お気に入りのモノモンを見つけて、図鑑を埋めていってね。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
