import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  X,
  Download,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react";
import { MonomonArt } from "@/components/MonomonArt";
import { MonomonCard } from "@/components/MonomonCard";
import { ShareModal } from "@/components/ShareModal";
import { useDex, removeFromDex } from "@/lib/dex";
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
        content: "これまでに見つけたモノモンたちの図鑑。",
      },
    ],
  }),
  component: Zukan,
});

function Zukan() {
  const dex = useDex();
  const [selected, setSelected] = useState<Monomon | null>(null);

  return (
    <div className="min-h-[100svh] gradient-sky px-5 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          onClick={tap}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card/80 text-foreground shadow-soft active:scale-95"
          aria-label="ホームへ"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold text-foreground">図鑑</h1>
        {dex.length > 0 && (
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
            {dex.length}たい
          </span>
        )}
      </header>

      {dex.length === 0 ? (
        <div className="flex min-h-[60svh] flex-col items-center justify-center text-center">
          <div className="mb-6 text-6xl opacity-80">🔍</div>
          <p className="text-lg font-bold text-foreground">
            まだ だれも いません
          </p>
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
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {dex.map((m) => {
            const style = CATEGORY_STYLES[m.category];
            return (
              <button
                key={m.id}
                onClick={() => {
                  tap();
                  setSelected(m);
                }}
                className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft active:scale-95"
              >
                <div
                  className="aspect-square p-1"
                  style={{
                    backgroundImage: `linear-gradient(160deg, ${style.bg[0]}, ${style.bg[1]})`,
                  }}
                >
                  <MonomonArt seed={m.seed} category={m.category} />
                </div>
                <span className="truncate px-1 py-1.5 text-center text-xs font-bold text-foreground">
                  {m.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <DetailSheet
          monomon={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function DetailSheet({
  monomon,
  onClose,
}: {
  monomon: Monomon;
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
      playSound("save");
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
        <div className="mb-3 flex justify-end">
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
