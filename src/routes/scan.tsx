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
import { saveCardImage } from "@/lib/card-image";
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
      const where = await saveCardImage(result);
      toast.success(
        where === "photos" ? "写真アプリに保存しました📸" : "画像を保存しました",
      );
    } catch {
      toast.error("うまく保存できなかったよ　もう一度ためしてみてね");
    } finally {
      setSaving(false);
    }
  };

  const isReveal = phase === "reveal";
  const isResult = phase === "result";

  return (
    <div
      className={`relative flex min-h-[100svh] flex-col ${
        isReveal ? "" : "px-6 pb-28 pt-[max(1rem,env(safe-area-inset-top))]"
      } ${
        isReveal
          ? "world-night-search"
          : isResult
          ? "world-result-room"
          : "home-photo-bg"
      }`}
    >




      {/* ヘッダー（撮影開始画面は入口なので戻る矢印を出さない） */}
      {phase !== "reveal" && phase !== "choose" && (
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
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-foreground">
              モノを
              <br />
              撮ってみよう
            </h1>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              今日もどこかに
              <br />
              モノモンが待っているよ
            </p>
          </div>

          {/* オレンジのカメラ・ボール（キラキラ粒子つき） */}
          <div className="relative my-10 flex h-40 w-40 items-center justify-center">
            <span aria-hidden className="pointer-events-none absolute -inset-4 rounded-full gradient-primary opacity-30 blur-2xl animate-breathe" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full gradient-primary shadow-float animate-breathe">
              <Camera className="h-14 w-14 text-primary-foreground" strokeWidth={1.7} />
            </div>
            <Sparkles aria-hidden className="absolute -top-1 right-2 h-4 w-4 text-primary/70 animate-twinkle" />
            <Sparkles aria-hidden className="absolute bottom-1 -left-1 h-3.5 w-3.5 text-accent/70 animate-twinkle" style={{ animationDelay: "0.8s" }} />
            <Sparkles aria-hidden className="absolute top-6 -right-3 h-3 w-3 text-primary/60 animate-twinkle" style={{ animationDelay: "1.4s" }} />
          </div>

          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={openCamera}
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
              className="flex w-full items-center justify-center gap-3 rounded-full bg-card/90 py-4 text-lg font-bold text-foreground shadow-soft backdrop-blur active:scale-95"
            >
              <ImagePlus className="h-5 w-5 text-primary" />
              写真を選ぶ
            </button>
          </div>
        </div>
      )}

      {phase === "confirm" && photo && (
        <div className="m-auto flex w-full flex-col items-center justify-center py-6 text-center">
          <div className="animate-pop-in">
            <div className="relative mx-auto h-64 w-64 overflow-hidden rounded-[34px] shadow-float">
              <img
                src={photo}
                alt="撮影した写真"
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 rounded-[34px] ring-1 ring-inset ring-card/40" />
            </div>
          </div>

          <div className="mt-8 space-y-1">
            <h1 className="text-xl font-extrabold text-foreground">
              この写真でさがす？
            </h1>
            <p className="text-sm text-muted-foreground">
              モノモンがかくれているかも
            </p>
          </div>

          <div className="mt-9 grid w-full max-w-sm grid-cols-2 gap-3">
            <button
              onClick={() => {
                tap();
                openCamera();
              }}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-card py-4 text-[15px] font-bold text-foreground shadow-soft active:scale-95"
            >
              📷 撮り直す
            </button>
            <button
              onClick={startSearch}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full gradient-primary py-4 text-[15px] font-bold text-primary-foreground shadow-float active:scale-95"
            >
              🔍 モノモンを探す
            </button>
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            見つかるまで数秒です
          </p>
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
          <div className="mx-auto w-full max-w-sm">
            {/* 上部：「図鑑に登録しました」小カプセル */}
            <div className="mt-1 flex justify-center">
              <p className="discovery-glass-capsule inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold text-primary animate-pop-in">
                <Sparkles className="h-4 w-4" />
                図鑑に登録しました！
              </p>
            </div>

            {/* オレンジのリボン：発見の喜び（自然にフェードアウト） */}
            <div className="discovery-announce pointer-events-none relative mx-auto mt-4 flex justify-center">
              <span aria-hidden className="discovery-ribbon-halo" />
              <div className="discovery-ribbon">
                <Sparkles aria-hidden className="absolute -top-1 left-3 h-3.5 w-3.5 text-white/90" />
                新しいモノモンを発見！
                <Sparkles aria-hidden className="absolute -bottom-1 right-4 h-3.5 w-3.5 text-white/90" />
              </div>
            </div>

            <div className="mt-2">
              <MonomonCard monomon={result} animate preferOfficialArt variant="discovery" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="discovery-glass-capsule flex items-center justify-center gap-2 whitespace-nowrap rounded-full py-4 text-sm font-bold text-foreground active:scale-95"
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
                className="discovery-glass-capsule flex items-center justify-center gap-2 whitespace-nowrap rounded-full py-4 text-sm font-bold text-foreground active:scale-95"
              >
                <Share2 className="h-4 w-4 text-primary" />
                シェア
              </button>
              <Link
                to="/zukan"
                onClick={tap}
                className="discovery-glass-capsule flex items-center justify-center gap-2 whitespace-nowrap rounded-full py-4 text-sm font-bold text-foreground active:scale-95"
              >
                <Check className="h-4 w-4 text-primary" />
                図鑑を見る
              </Link>
              <Link
                to="/"
                onClick={tap}
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-float active:scale-95"
              >
                <Home className="h-4 w-4" />
                ホーム
              </Link>
            </div>

            {/* 応援カード（半透明で背景から浮かせて可読性を確保） */}
            <div className="discovery-glass-capsule mt-4 rounded-full">
              <SupportButton variant="result" />
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
