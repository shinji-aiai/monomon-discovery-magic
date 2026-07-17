import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Share2, Loader2 } from "lucide-react";
import { MonomonArt } from "@/components/MonomonArt";
import { ShareModal } from "@/components/ShareModal";
import { DiscoveryReveal } from "@/components/DiscoveryReveal";
import { GentleError, type GentleErrorKind } from "@/components/GentleError";
import { BottomNav } from "@/components/BottomNav";
import { SupportButton } from "@/components/SupportButton";
import { normalizeCapturedImage } from "@/lib/image-utils";
import {
  generateMonomon,
  type Monomon,
  type PipelineDiagnostic,
} from "@/lib/monomon";
import { addToDex, meetMonomon } from "@/lib/dex";
import { saveCardImage } from "@/lib/card-image";
import { tap } from "@/lib/sound";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "出会う｜モノモン" },
      { name: "description", content: "身の回りのモノに宿る小さな精霊と出会う" },
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
  const [diagnostic, setDiagnostic] = useState<PipelineDiagnostic | undefined>();

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

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
      .catch(() => {});
    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  const openCamera = () => {
    tap();
    if (camDenied.current) {
      setErrKind("permission");
      setPhase("error");
      return;
    }
    // input.value をクリアして、同じファイルの再選択でも change が発火するようにする
    if (cameraRef.current) cameraRef.current.value = "";
    cameraRef.current?.click();
  };

  /**
   * GentleError の「もう一度撮る」からの復帰。
   * iOS Safari のユーザージェスチャー要件を守るため、実際のカメラ起動は
   * <label htmlFor="monomon-camera-input"> のネイティブ挙動に任せ、
   * ここでは同期的に state をリセットするだけにする。
   */
  const retry = () => {
    tap();
    setDiagnostic(undefined);
    // ネットワーク／混雑 → 同じ写真でもう一度出会いにいく（label なしの通常ボタン経由）
    if (
      (errKind === "network" ||
        errKind === "busy" ||
        errKind === "generation_timeout" ||
        errKind === "generation_failed" ||
        errKind === "storage") &&
      photo
    ) {
      setResult(null);
      setRegistered(false);
      setPhase("reveal");
      return;
    }
    // それ以外は state をリセット。カメラ input は label が同ジェスチャーで開く。
    // 次の change に備えて input.value もクリアしておく。
    if (cameraRef.current) cameraRef.current.value = "";
    setResult(null);
    setPhoto(null);
    setRegistered(false);
    setPhase("choose");
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    tap();
    const receivedAt = performance.now();
    console.info("[monomon-pipeline]", {
      stage: "PHOTO_RECEIVED",
      inputMimeType: file.type || "unknown",
      inputImageBytes: file.size,
    });
    try {
      const normalized = await normalizeCapturedImage(file);
      console.info("[monomon-pipeline]", {
        stage: "PHOTO_CONVERTED",
        inputMimeType: normalized.mimeType,
        inputImageBytes: normalized.byteSize,
        width: normalized.width,
        height: normalized.height,
        elapsedMs: Math.round(performance.now() - receivedAt),
      });
      setPhoto(normalized.dataUrl);
      setResult(null);
      setRegistered(false);
      setDiagnostic(undefined);
      setPhase("confirm");
    } catch (error) {
      const nextDiagnostic: PipelineDiagnostic = {
        failedStage: "PHOTO_CONVERTED",
        reason: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.name : typeof error,
        elapsedMs: Math.round(performance.now() - receivedAt),
        inputMimeType: file.type || "unknown",
        inputImageBytes: file.size,
      };
      console.error("[monomon-pipeline]", nextDiagnostic);
      setDiagnostic(nextDiagnostic);
      toast.error("もう一度えらんでみてね");
    }
  };

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
        where === "photos" ? "写真アプリに保存しました" : "画像を保存しました",
      );
    } catch (err) {
      console.error("[monomon] 画像保存に失敗:", err);
      toast.error("うまく保存できなかったよ もう一度ためしてみてね");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="relative flex min-h-[100svh] flex-col px-6 pb-28 pt-[max(1rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: "#FAF8F3" }}
    >
      {phase !== "reveal" && (
        <header className="flex items-center">
          {phase === "result" ? (
            <button
              onClick={reset}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 active:scale-95"
              aria-label="戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              to="/"
              onClick={tap}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 active:scale-95"
              aria-label="ホームへ"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </header>
      )}

      <input
        ref={cameraRef}
        id="monomon-camera-input"
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

      {/* ─── choose ─── モノに出会いに行く導入。静かに */}
      {phase === "choose" && (
        <div className="m-auto flex w-full max-w-sm flex-col items-center justify-center py-6 text-center">
          <p className="whitespace-pre-line text-[15px] font-medium leading-[2] text-foreground/70">
            {"身の回りの\n大切にしたいモノを\nそっと撮ってみて"}
          </p>

          <div className="mt-12 w-full space-y-3">
            <button
              onClick={openCamera}
              className="w-full rounded-full bg-foreground py-[18px] text-[15px] font-semibold tracking-[0.14em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]"
            >
              写真を撮る
            </button>
            <button
              onClick={() => {
                tap();
                libraryRef.current?.click();
              }}
              className="w-full rounded-full bg-white/70 py-[18px] text-[14px] font-medium tracking-[0.12em] text-foreground/70 backdrop-blur active:scale-[0.985]"
              style={{ boxShadow: "0 4px 14px -8px rgba(60,45,25,0.18)" }}
            >
              写真から選ぶ
            </button>
          </div>
        </div>
      )}

      {/* ─── confirm ─── 実物写真が主役。ボタンは静かに */}
      {phase === "confirm" && photo && (
        <div className="m-auto flex w-full max-w-sm flex-col items-center justify-center py-6 text-center">
          <div
            className="relative aspect-[4/5] w-64 overflow-hidden rounded-[28px] sm:w-72"
            style={{ boxShadow: "0 24px 44px -20px rgba(60,45,25,0.34)" }}
          >
            <img src={photo} alt="" className="h-full w-full object-cover" />
          </div>

          <p className="mt-8 text-[14px] font-medium tracking-[0.04em] text-foreground/60">
            この写真で出会いにいく？
          </p>

          <div className="mt-8 w-full space-y-3">
            <button
              onClick={startSearch}
              className="w-full rounded-full bg-foreground py-[18px] text-[15px] font-semibold tracking-[0.14em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]"
            >
              出会いにいく
            </button>
            <button
              onClick={() => {
                tap();
                openCamera();
              }}
              className="w-full py-3 text-[13px] font-medium tracking-[0.08em] text-foreground/50 active:opacity-70"
            >
              撮り直す
            </button>
          </div>
        </div>
      )}

      {phase === "reveal" && photo && (
        <DiscoveryReveal
          photo={photo}
          generate={() => generateMonomon(photo)}
          onGenerated={async (m) => {
            if (!registered) {
              console.info("[monomon-pipeline]", { stage: "MEMORY_SAVE_STARTED", monomonId: m.id });
              const saved = await addToDex(m);
              meetMonomon(saved.monomon.id);
              setRegistered(true);
              console.info("[monomon-pipeline]", { stage: "MEMORY_SAVE_SUCCEEDED", monomonId: saved.monomon.id });
              setResult(saved.monomon);
              return saved.monomon;
            }
            setResult(m);
            return m;
          }}
          onDone={(m) => {
            setResult(m);
            setPhase("result");
          }}
          onError={(kind, error) => {
            setErrKind(kind);
            setDiagnostic(error?.diagnostic);
            setPhase("error");
          }}
        />
      )}

      {phase === "error" && (
        <GentleError
          kind={errKind}
          cameraInputId="monomon-camera-input"
          onRetry={retry}
          onChooseAnother={() => {
            if (cameraRef.current) cameraRef.current.value = "";
            setResult(null);
            setPhoto(null);
            setRegistered(false);
            setDiagnostic(undefined);
          }}
          diagnostic={diagnostic}
        />
      )}

      {/* ─── result ─── 出会えた余韻。写真が主役。モノモンは端から覗くだけ */}
      {phase === "result" && result && (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center">
          <div className="relative mt-2">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[40px]"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(210,180,130,0.20), rgba(210,180,130,0) 72%)",
              }}
            />
            <div
              className="relative aspect-[4/5] w-64 overflow-hidden rounded-[28px] sm:w-72"
              style={{ boxShadow: "0 24px 48px -22px rgba(60,45,25,0.34)" }}
            >
              {/* 合成写真があればそちらを主役に。無ければ元写真＋SVGモノモンでフォールバック */}
              {result.composedPhoto ? (
                <img
                  src={result.composedPhoto}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  {result.photo && (
                    <img
                      src={result.photo}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="pointer-events-none absolute -bottom-3 -right-2 h-24 w-24 drop-shadow-[0_10px_18px_rgba(60,45,25,0.30)] animate-soft-peek">
                    <MonomonArt monomon={result} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-10 text-center">
            {result.objectLabel && (
              <p className="text-[11px] font-medium tracking-[0.16em] text-foreground/40">
                {result.uncertain
                  ? `${result.objectLabel}のなかまかもしれない`
                  : `${result.objectLabel}にやどる`}
              </p>
            )}
            <p className="mt-2 text-[20px] font-semibold tracking-[0.04em] text-foreground/80">
              {result.name}
            </p>
          </div>

          <p className="mx-auto mt-6 max-w-[18rem] whitespace-pre-line text-center text-[13px] font-medium leading-[2] text-foreground/60">
            {result.description}
          </p>

          <div className="mt-10 w-full space-y-3">
            <Link
              to="/zukan"
              onClick={tap}
              className="block w-full rounded-full bg-foreground py-[18px] text-center text-[15px] font-semibold tracking-[0.14em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]"
            >
              思い出に残す
            </Link>
            <Link
              to="/"
              onClick={tap}
              className="block w-full py-3 text-center text-[13px] font-medium tracking-[0.08em] text-foreground/50 active:opacity-70"
            >
              ホームへ戻る
            </Link>
          </div>

          {/* 保存・シェアは控えめに */}
          <div className="mt-6 flex items-center gap-6">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 text-[12px] font-medium tracking-[0.06em] text-foreground/45 active:opacity-70"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              画像を保存
            </button>
            <button
              onClick={() => {
                tap();
                setSharing(true);
              }}
              className="flex items-center gap-2 text-[12px] font-medium tracking-[0.06em] text-foreground/45 active:opacity-70"
            >
              <Share2 className="h-3.5 w-3.5" />
              シェア
            </button>
          </div>

          <div className="mt-8 text-center">
            <SupportButton variant="result" />
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
