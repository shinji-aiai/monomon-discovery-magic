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
import { fileToDataUrl, downscaleDataUrl } from "@/lib/image-utils";
import { generateMonomon, type Monomon } from "@/lib/monomon";
import { addToDex } from "@/lib/dex";
import { downloadCardImage } from "@/lib/card-image";
import { tap, playSound, haptic } from "@/lib/sound";

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

type Phase = "choose" | "analyzing" | "result";

const STEPS = [
  "解析中…",
  "モノの記憶を読み取り中…",
  "反応を検知しました…",
  "モノモンを発見しました！",
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Scan() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [photo, setPhoto] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<Monomon | null>(null);
  const [registered, setRegistered] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    tap();
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleDataUrl(raw, 720);
      setPhoto(small);
      void runAnalysis(small);
    } catch {
      toast.error("写真を読み込めませんでした");
    }
  };

  const runAnalysis = async (photoData: string) => {
    setPhase("analyzing");
    setStepIndex(0);
    playSound("scan");
    const genPromise = generateMonomon(photoData);

    for (let i = 0; i < STEPS.length; i++) {
      if (cancelled.current) return;
      setStepIndex(i);
      await wait(i === STEPS.length - 1 ? 750 : 1050);
    }

    const monomon = await genPromise;
    if (cancelled.current) return;
    setResult(monomon);
    setRegistered(false);
    setPhase("result");
    playSound("discover");
    haptic([18, 40, 24]);
  };

  const reset = () => {
    tap();
    setResult(null);
    setPhoto(null);
    setRegistered(false);
    setPhase("choose");
  };

  const register = () => {
    if (!result || registered) return;
    addToDex(result);
    setRegistered(true);
    playSound("save");
    haptic(18);
    toast.success("図鑑に登録しました");
  };

  const save = async () => {
    if (!result) return;
    tap();
    setSaving(true);
    try {
      await downloadCardImage(result);
      playSound("save");
      toast.success("画像を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] flex-col gradient-sky px-6 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* ヘッダー */}
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

      {phase === "analyzing" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative h-64 w-64 overflow-hidden rounded-3xl shadow-float">
            {photo && (
              <img
                src={photo}
                alt="解析中の写真"
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]" />
            {/* スキャンライン */}
            <div className="absolute inset-x-3 h-1 animate-scan-sweep rounded-full bg-gradient-to-r from-transparent via-card to-transparent shadow-glow" />
            {/* リング */}
            <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card/70 animate-pulse-ring" />
            <Sparkles className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-card animate-spin-slow" />
          </div>

          <p
            key={stepIndex}
            className="mt-10 animate-rise-in text-lg font-bold text-foreground"
          >
            {STEPS[stepIndex]}
          </p>
          <div className="mt-4 flex gap-2">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i <= stepIndex ? "w-6 bg-primary" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="flex flex-1 flex-col">
          <div className="mb-4 mt-2 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-4 py-1.5 text-sm font-bold text-primary animate-pop-in">
              <Sparkles className="h-4 w-4" />
              モノモンを発見しました！
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <MonomonCard monomon={result} animate />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={register}
                disabled={registered}
                className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold active:scale-95 ${
                  registered
                    ? "bg-secondary text-secondary-foreground"
                    : "gradient-primary text-primary-foreground shadow-soft"
                }`}
              >
                {registered ? (
                  <>
                    <Check className="h-4 w-4" />
                    登録しました
                  </>
                ) : (
                  "図鑑に登録"
                )}
              </button>
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
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 rounded-2xl bg-accent/40 py-3.5 text-sm font-bold text-accent-foreground active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                もう一度見つける
              </button>
            </div>
          </div>
        </div>
      )}

      {sharing && result && (
        <ShareModal monomon={result} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}
