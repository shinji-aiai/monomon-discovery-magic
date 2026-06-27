import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  X,
  Download,
  Share2,
  Trash2,
  Loader2,
  Heart,
  Star,
} from "lucide-react";
import { MonomonArt } from "@/components/MonomonArt";
import { MonomonCard } from "@/components/MonomonCard";
import { ShareModal } from "@/components/ShareModal";
import { BottomNav } from "@/components/BottomNav";
import { useDex, removeFromDex, toggleFavorite } from "@/lib/dex";
import { CATEGORY_STYLES } from "@/lib/monomon-data";
import { downloadCardImage } from "@/lib/card-image";
import type { Monomon } from "@/lib/monomon";
import { tap, playSound, haptic } from "@/lib/sound";

export const Route = createFileRoute("/zukan")({
  head: () => ({
    meta: [
      { title: "図鑑｜モノモン" },
      {
        name: "description",
        content: "これまでに見つけたモノモンたちの図鑑。集めて、お気に入りを見つけよう。",
      },
    ],
  }),
  component: Zukan,
});

type Tab = "all" | "fav";

function Zukan() {
  const dex = useDex();
  const [selected, setSelected] = useState<Monomon | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  const kinds = new Set(dex.map((m) => m.category)).size;

  // 古い順に番号を振る（No.001 = 最初の相棒）
  const numbered = useMemo(() => {
    const map = new Map<string, number>();
    [...dex]
      .sort(
        (a, b) =>
          new Date(a.discoveredAt).getTime() -
          new Date(b.discoveredAt).getTime(),
      )
      .forEach((m, i) => map.set(m.id, i + 1));
    return map;
  }, [dex]);

  const list = tab === "fav" ? dex.filter((m) => m.favorite) : dex;

  return (
    <div className="min-h-[100svh] gradient-sky px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold text-foreground">図鑑</h1>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          見つけた精霊　{dex.length}たい・{kinds}/8 しゅるい
        </p>
      </header>

      {/* 進捗バー */}
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-card/80 shadow-soft">
        <div
          className="h-full rounded-full gradient-primary transition-all"
          style={{ width: `${(kinds / 8) * 100}%` }}
        />
      </div>

      {/* タブ */}
      {dex.length > 0 && (
        <div className="mb-5 flex gap-2">
          <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
            すべて
          </TabBtn>
          <TabBtn active={tab === "fav"} onClick={() => setTab("fav")}>
            <Star className="h-3.5 w-3.5" /> お気に入り
          </TabBtn>
        </div>
      )}

      {dex.length === 0 ? (
        <Empty />
      ) : list.length === 0 ? (
        <div className="flex min-h-[40svh] flex-col items-center justify-center text-center">
          <Star className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-bold text-foreground">
            お気に入りは まだ いません
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            カードの♡を タップして お気に入りに追加できます。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((m) => (
            <DexCell
              key={m.id}
              monomon={m}
              no={numbered.get(m.id) ?? 0}
              onOpen={() => {
                tap();
                setSelected(m);
              }}
            />
          ))}

          {tab === "all" && (
            <Link
              to="/scan"
              onClick={tap}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-card/40 text-muted-foreground active:scale-95"
            >
              <span className="text-3xl opacity-60">？</span>
              <span className="text-xs font-bold">つぎを さがす</span>
            </Link>
          )}
        </div>
      )}

      {selected && (
        <DetailSheet
          monomon={selected}
          no={numbered.get(selected.id) ?? 0}
          onClose={() => setSelected(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => {
        tap();
        onClick();
      }}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
        active
          ? "gradient-primary text-primary-foreground shadow-soft"
          : "bg-card/80 text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DexCell({
  monomon,
  no,
  onOpen,
}: {
  monomon: Monomon;
  no: number;
  onOpen: () => void;
}) {
  const style = CATEGORY_STYLES[monomon.category];
  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-card shadow-soft active:scale-95"
    >
      <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-card/80 px-2 py-0.5 text-[0.62rem] font-extrabold text-muted-foreground backdrop-blur">
        No.{String(no).padStart(3, "0")}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(monomon.id);
          haptic(12);
        }}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card/80 backdrop-blur active:scale-90"
        aria-label="お気に入り"
      >
        <Heart
          className={`h-4 w-4 ${monomon.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      </button>
      <div
        className="aspect-square p-2"
        style={{
          backgroundImage: `linear-gradient(160deg, ${style.bg[0]}, ${style.bg[1]})`,
        }}
      >
        <div className="h-full w-full drop-shadow-[0_8px_10px_rgba(90,60,40,0.18)]">
          <MonomonArt monomon={monomon} />
        </div>
      </div>
      <div className="px-2 py-2 text-center">
        <p className="truncate text-sm font-extrabold text-foreground">
          {monomon.name}
        </p>
        <p className="truncate text-[0.66rem] font-bold text-muted-foreground">
          {style.emoji} {monomon.personality}
        </p>
      </div>
    </button>
  );
}

function Empty() {
  return (
    <div className="flex min-h-[55svh] flex-col items-center justify-center text-center">
      <div className="mb-6 text-6xl opacity-80">🔍</div>
      <p className="text-lg font-bold text-foreground">まだ だれも いません</p>
      <p className="mt-2 text-sm text-muted-foreground">
        モノを撮って、最初の精霊を見つけよう。
      </p>
      <Link
        to="/scan"
        onClick={tap}
        className="mt-8 flex items-center gap-2 rounded-full gradient-primary px-7 py-3.5 text-base font-bold text-primary-foreground shadow-float active:scale-95"
      >
        <Camera className="h-5 w-5" />
        見つける
      </Link>
    </div>
  );
}

function DetailSheet({
  monomon,
  no,
  onClose,
}: {
  monomon: Monomon;
  no: number;
  onClose: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    tap();
    setSaving(true);
    try {
      await downloadCardImage(monomon);
      toast.success("画像を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const del = () => {
    removeFromDex(monomon.id);
    haptic(20);
    toast.success("削除しました");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md animate-rise-in rounded-t-3xl bg-background p-5 pb-8 shadow-float sm:my-6 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-extrabold text-muted-foreground">
            No.{String(no).padStart(3, "0")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toggleFavorite(monomon.id);
                haptic(12);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted active:scale-90"
              aria-label="お気に入り"
            >
              <Heart
                className={`h-5 w-5 ${monomon.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </button>
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
        </div>

        <MonomonCard monomon={monomon} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-2xl bg-card py-3.5 text-sm font-bold text-foreground shadow-soft active:scale-95"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            画像を保存
          </button>
          <button
            onClick={() => {
              tap();
              setSharing(true);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
          >
            <Share2 className="h-4 w-4" />
            シェア
          </button>
        </div>

        {confirmDelete ? (
          <div className="mt-3 rounded-2xl bg-destructive/10 p-3 text-center">
            <p className="text-sm font-bold text-destructive">
              このモノモンを削除しますか？
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  tap();
                  setConfirmDelete(false);
                }}
                className="rounded-xl bg-card py-2.5 text-sm font-bold text-foreground active:scale-95"
              >
                やめる
              </button>
              <button
                onClick={del}
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
              setConfirmDelete(true);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-destructive active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            削除する
          </button>
        )}
      </div>

      {sharing && (
        <ShareModal monomon={monomon} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}
