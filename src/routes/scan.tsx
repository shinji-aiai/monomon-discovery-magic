import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Check,
  Download,
  Share2,
  RefreshCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import { MonomonCard } from "@/components/MonomonCard";
import { ShareModal } from "@/components/ShareModal";
import { DiscoveryReveal } from "@/components/DiscoveryReveal";
import { BottomNav } from "@/components/BottomNav";
import { fileToDataUrl, downscaleDataUrl } from "@/lib/image-utils";
import { generateMonomon, type Monomon } from "@/lib/monomon";
import { addToDex } from "@/lib/dex";
import { downloadCardImage } from "@/lib/card-image";
import { tap } from "@/lib/sound";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "見つける｜モノモン" },
      {
        name: "description",
        content: "写真を撮って、モノに宿る小さな精霊を見つけよう。",
      },
    ],
  }),
  component: Scan,
});

type Phase = "choose" | "reveal" | "result";

function Scan() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<Monomon | null>(null);
  const [registered, setRegistered] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // 結果が出たら自動で図鑑に登録（コレクションが途切れない体験）
  useEffect(() => {
    if (phase === "result" && result && !registered) {
      addToDex(result);
      setRegistered(true);
    }
  }, [phase, result, registered]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    tap();
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleDataUrl(raw, 720);
      setPhoto(small);
      setResult(null);
      setRegistered(false);
      setPhase("reveal");
    } catch {
      toast.error("写真を読み込めませんでした");
    }
  };

  const reset = () => {
    tap();
    setResult(null);
    setPhoto(null);
    setRegistered(false);
    setPhase("choose");
  };

  const save = async () => {
    if (!result) return;
    tap();
    setSaving(true);
    try {
      await downloadCardImage(result);
      toast.success("画像を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] flex-col gradient-sky px-6 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* ヘッダー */}
      {phase !== "reveal" && (
        <header className="flex items-center">
          {phase === "result" ? (
            <button
              onClick={reset}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card/80 text-foreground shadow-soft active:scale-95"
              aria-label="戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              to="/"
              onClick={tap}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card/80 text-foreground shadow-soft active:scale-95"
              aria-label="ホームへ"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </header>
      )}

      {/* 隠しファイル入力 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {phase === "choose" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full gradient-magic shadow-glow animate-breathe">
            <Camera className="h-14 w-14 text-card" strokeWidth={1.6} />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            モノを撮ってみよう
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            身の回りのモノを1枚。
            <br />
            どんな精霊が出てくるかな？
          </p>

          <div className="mt-10 w-full max-w-sm space-y-3">
            <button
              onClick={() => {
                tap();
                cameraRef.current?.click();
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full gradient-primary py-4 text-lg font-bold text-primary-foreground shadow-float active:scale-95"
            >
              <Camera className="h-5 w-5" />
              写真を撮る
            </button>
            <button
              onClick={() => {
                tap();
                libraryRef.current?.click();
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-card py-4 text-lg font-bold text-foreground shadow-soft active:scale-95"
            >
              <ImagePlus className="h-5 w-5 text-primary" />
              写真を選ぶ
            </button>
          </div>
        </div>
      )}

      {phase === "reveal" && photo && (
        <DiscoveryReveal
          photo={photo}
          generate={() => generateMonomon(photo)}
          onDone={(m) => {
            setResult(m);
            setPhase("result");
          }}
        />
      )}

      {phase === "result" && result && (
        <div className="flex flex-1 flex-col">
          <div className="mb-4 mt-2 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-4 py-1.5 text-sm font-bold text-primary animate-pop-in">
              <Sparkles className="h-4 w-4" />
              図鑑に登録しました！
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <MonomonCard monomon={result} animate />

            <div className="mt-5 grid grid-cols-2 gap-3">
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
                className="flex items-center justify-center gap-2 rounded-2xl bg-card py-3.5 text-sm font-bold text-foreground shadow-soft active:scale-95"
              >
                <Share2 className="h-4 w-4 text-primary" />
                シェア
              </button>
              <Link
                to="/zukan"
                onClick={tap}
                className="flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-bold text-secondary-foreground active:scale-95"
              >
                <Check className="h-4 w-4" />
                図鑑を見る
              </Link>
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                もう一度
              </button>
            </div>
          </div>
        </div>
      )}

      {sharing && result && (
        <ShareModal monomon={result} onClose={() => setSharing(false)} />
      )}

      {phase !== "reveal" && <BottomNav />}
    </div>
  );
}
