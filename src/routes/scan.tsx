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
  Home,
  Sparkles,
  Loader2,
} from "lucide-react";
import { MonomonCard } from "@/components/MonomonCard";
import { ShareModal } from "@/components/ShareModal";
import { DiscoveryReveal } from "@/components/DiscoveryReveal";
import { GentleError, type GentleErrorKind } from "@/components/GentleError";
import { BottomNav } from "@/components/BottomNav";
import { SupportButton } from "@/components/SupportButton";
import { fileToDataUrl, downscaleDataUrl } from "@/lib/image-utils";
import { generateMonomon, type Monomon } from "@/lib/monomon";
import { addToDex, meetMonomon } from "@/lib/dex";
import { downloadCardImage } from "@/lib/card-image";
import { tap } from "@/lib/sound";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "見つける｜モノモン" },
      {
        name: "description",
        content: "写真を撮ってモノに宿る小さな精霊を見つけよう",
      },
    ],
  }),
  component: Scan,
});

type Phase = "choose" | "confirm" | "reveal" | "result" | "error";

function Scan() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<Monomon | null>(null);
  const [registered, setRegistered] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errKind, setErrKind] = useState<GentleErrorKind>("unknown");

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // カメラ権限を先に把握しておく（クリック時に await しないための準備）
  const camDenied = useRef(false);
  useEffect(() => {
    const perms = navigator.permissions;
    if (!perms?.query) return;
    let status: PermissionStatus | null = null;
    const sync = () => {
      camDenied.current = status?.state === "denied";
    };
    perms
      .query({ name: "camera" as PermissionName })
      .then((s) => {
        status = s;
        sync();
        s.onchange = sync;
      })
      .catch(() => {
        // 権限の問い合わせに未対応な端末はそのまま進む
      });
    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  // カメラを開く（クリックと同じ同期処理で開く＝iOSでも確実に起動する）
  const openCamera = () => {
    tap();
    // 権限がOFFのときだけやさしく案内する
    if (camDenied.current) {
      setErrKind("permission");
      setPhase("error");
      return;
    }
    cameraRef.current?.click();
  };

  // 出会いをやり直す
  const retry = () => {
    if (errKind === "permission") {
      openCamera();
      return;
    }
    tap();
    // 写りが原因のときは、同じ写真ではなく撮り直してもらう
    const needsNewPhoto =
      errKind === "too_far" ||
      errKind === "too_dark" ||
      errKind === "blurry" ||
      errKind === "unclear";
    if (photo && !needsNewPhoto) {
      setResult(null);
      setRegistered(false);
      setPhase("reveal");
    } else {
      setResult(null);
      setPhoto(null);
      setRegistered(false);
      setPhase("choose");
    }
  };

  // 結果が出たら自動で図鑑に登録（コレクションが途切れない体験）
  useEffect(() => {
    if (phase === "result" && result && !registered) {
      addToDex(result);
      // 発見＝その日はじめての出会い → なかよし度 +5
      meetMonomon(result.id);
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
      // Apple標準の確認ではなく、モノモンらしい確認画面でひと呼吸おく
      setPhase("confirm");
    } catch {
      toast.error("もう一度えらんでみてね");
    }
  };

  // 確認画面から「モノモンを探す」→ 出会いの演出＆AI認識をはじめる
  const startSearch = () => {
    tap();
    setResult(null);
    setRegistered(false);
    setPhase("reveal");
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
      toast.error("もう一度ためしてみてね");
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
        <div className="m-auto flex w-full flex-col items-center justify-center py-6 text-center">
          <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border border-border/50 bg-card/70 shadow-float backdrop-blur animate-breathe">
            <Camera className="h-12 w-12 text-primary" strokeWidth={1.4} />
          </div>
          <h1 className="text-[1.35rem] font-extrabold tracking-tight text-foreground">
            モノを撮ってみよう
          </h1>
          <p className="mt-2.5 max-w-xs text-[0.86rem] font-medium leading-relaxed text-muted-foreground">
            身の回りのモノを1枚
            <br />
            どんな精霊が出てくるかな
          </p>

          <div className="mt-10 w-full max-w-sm space-y-1 text-center">
            <p className="text-[0.82rem] font-medium tracking-wide text-foreground/80">
              モノ全体が入るように撮ってね
            </p>
            <p className="text-[0.72rem] font-normal text-muted-foreground">
              ぬいぐるみ・文房具・植物がおすすめ
            </p>
          </div>

          <div className="mt-5 w-full max-w-sm space-y-3">
            <button
              onClick={openCamera}
              className="flex w-full items-center justify-center gap-3 rounded-full gradient-primary py-4 text-base font-extrabold tracking-wide text-primary-foreground shadow-float active:scale-95"
            >
              <Camera className="h-5 w-5" />
              写真を撮る
            </button>
            <button
              onClick={() => {
                tap();
                libraryRef.current?.click();
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-border/50 bg-card/80 py-4 text-base font-medium tracking-wide text-foreground shadow-soft active:scale-95"
            >
              <ImagePlus className="h-5 w-5 text-primary/80" />
              写真を選ぶ
            </button>
          </div>
        </div>

      )}

      {phase === "confirm" && photo && (
        <div className="m-auto flex w-full flex-col items-center justify-center py-6 text-center">
          <div className="animate-pop-in">
            <div className="relative mx-auto h-64 w-64 overflow-hidden rounded-[32px] shadow-float">
              <img
                src={photo}
                alt="撮影した写真"
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-border/40" />
            </div>
          </div>

          <div className="mt-8 space-y-1.5">
            <h1 className="text-[1.2rem] font-extrabold tracking-tight text-foreground">
              この写真でさがす
            </h1>
            <p className="text-[0.82rem] font-medium text-muted-foreground">
              モノモンがかくれているかも
            </p>
          </div>

          <div className="mt-9 grid w-full max-w-sm grid-cols-2 gap-3">
            <button
              onClick={() => {
                tap();
                openCamera();
              }}
              className="flex items-center justify-center gap-2 rounded-full border border-border/50 bg-card/80 py-4 text-[0.92rem] font-medium tracking-wide text-foreground shadow-soft active:scale-95"
            >
              撮り直す
            </button>
            <button
              onClick={startSearch}
              className="flex items-center justify-center gap-2 rounded-full gradient-primary py-4 text-[0.92rem] font-extrabold tracking-wide text-primary-foreground shadow-float active:scale-95"
            >
              さがす
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
          onError={(kind) => {
            setErrKind(kind);
            setPhase("error");
          }}
          onCancel={reset}
        />

      )}

      {phase === "error" && <GentleError kind={errKind} onRetry={retry} />}


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
              <Link
                to="/"
                onClick={tap}
                className="flex items-center justify-center gap-2 rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
              >
                <Home className="h-4 w-4" />
                ホーム
              </Link>
            </div>

            {/* 応援（図鑑登録・画像保存・シェアの下に小さく） */}
            <div className="mt-4 text-center">
              <SupportButton variant="result" />
            </div>

            {/* 最後の余韻：もう一度探したくなる、そっとした締めくくり */}
            <p className="mt-8 animate-fade-in text-center text-xs font-medium text-muted-foreground/70">
              まだ見ぬモノモンが待っているかも
            </p>
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
