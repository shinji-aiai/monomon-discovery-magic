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
import { type Monomon } from "@/lib/monomon";
import {
  addToDex,
  meetMonomon,
  setImmersionImageId,
  getMonomon,
} from "@/lib/dex";
import {
  beginDiscovery,
  persistPreparedImmersion,
  type DiscoverySession,
} from "@/lib/discovery-pipeline";
import {
  getImmersionImage,
  deleteImmersionImage,
} from "@/lib/immersion-image-store";
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
  // Phase 1D: 没入画像の表示URL＆準備中フラグ
  const [immersionUrl, setImmersionUrl] = useState<string | null>(null);
  const [immersionPending, setImmersionPending] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // Phase 1D: 進行中の発見セッション。同じ写真に対する二重の recognition／image 呼び出しを防ぐロック。
  const sessionRef = useRef<DiscoverySession | null>(null);
  const sessionPhotoRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  // 画面から離脱した／リセットしたら、まだ未使用の画像は片付ける。
  const objectUrlRef = useRef<string | null>(null);
  const pendingImageIdRef = useRef<string | null>(null);

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
        /* noop */
      }
      objectUrlRef.current = null;
    }
  };

  const clearPendingImage = () => {
    const id = pendingImageIdRef.current;
    pendingImageIdRef.current = null;
    if (id) {
      void deleteImmersionImage(id).catch(() => {});
    }
  };

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

  // 画面を去るとき残った Object URL は必ず解放する
  useEffect(() => {
    return () => {
      revokeObjectUrl();
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
      // 同じ写真でリトライするなら既存セッションを使い直す（追加のAI/画像呼び出しはしない）
      setPhase("reveal");
    } else {
      resetSession();
      setResult(null);
      setPhoto(null);
      setRegistered(false);
      setPhase("choose");
    }
  };

  const resetSession = () => {
    sessionRef.current = null;
    sessionPhotoRef.current = null;
    inFlightRef.current = false;
    setImmersionUrl(null);
    setImmersionPending(false);
    revokeObjectUrl();
    clearPendingImage();
  };

  /**
   * Phase 1D: recognition と image generation を1回だけ発火するセッションを取得。
   * DiscoveryReveal の generate は recognition の結果だけを await する。
   */
  const ensureSession = (currentPhoto: string): Promise<Monomon> => {
    if (sessionRef.current && sessionPhotoRef.current === currentPhoto) {
      return Promise.resolve(sessionRef.current.monomon);
    }
    if (inFlightRef.current && sessionPhotoRef.current === currentPhoto) {
      // 想定外の並行呼び出し保険：既存セッション完了待ち
      return new Promise<Monomon>((resolve, reject) => {
        const tick = () => {
          if (sessionRef.current) resolve(sessionRef.current.monomon);
          else if (!inFlightRef.current) reject(new Error("session lost"));
          else setTimeout(tick, 50);
        };
        tick();
      });
    }
    inFlightRef.current = true;
    sessionPhotoRef.current = currentPhoto;
    return beginDiscovery(currentPhoto).then(
      (session) => {
        sessionRef.current = session;
        inFlightRef.current = false;
        // recognition と並行で走らせた immersion タスクをバックグラウンドで待つ
        if (session.immersionTask) {
          setImmersionPending(true);
          void session.immersionTask.then((res) => {
            if (sessionRef.current !== session) return; // 破棄済み
            if (!res.ok) {
              setImmersionPending(false);
              return;
            }
            // recognition 結果（＝ session.monomon.id）に紐づけて保存する
            void persistPreparedImmersion(session.monomon.id, res.compressed)
              .then(async (imageId) => {
                if (sessionRef.current !== session) {
                  void deleteImmersionImage(imageId).catch(() => {});
                  return;
                }
                pendingImageIdRef.current = imageId;
                // dex に既登録なら紐付け、未登録なら result 登録 effect 側でリンクを再確認
                const linked = setImmersionImageId(
                  session.monomon.id,
                  imageId,
                );
                if (linked) {
                  pendingImageIdRef.current = null;
                }
                // 表示用に Object URL を作る
                try {
                  const stored = await getImmersionImage(imageId);
                  if (sessionRef.current !== session) return;
                  if (stored?.blob) {
                    revokeObjectUrl();
                    const url = URL.createObjectURL(stored.blob);
                    objectUrlRef.current = url;
                    setImmersionUrl(url);
                  }
                } catch {
                  /* 表示は諦めるが、保存は残す */
                }
              })
              .catch(() => {
                /* 保存失敗はSVGにフォールバック */
              })
              .finally(() => {
                setImmersionPending(false);
              });
          });
        }
        return session.monomon;
      },
      (err) => {
        inFlightRef.current = false;
        sessionPhotoRef.current = null;
        throw err;
      },
    );
  };

  // 結果が出たら自動で図鑑に登録（コレクションが途切れない体験）
  useEffect(() => {
    if (phase === "result" && result && !registered) {
      const added = addToDex(result);
      // 発見＝その日はじめての出会い → なかよし度 +5
      meetMonomon(result.id);
      // 画像が先に保存されていたら（あるいは既登録で addToDex が no-op でも）ここでリンク
      const pendingId = pendingImageIdRef.current;
      if (pendingId) {
        const existing = getMonomon(result.id);
        if (existing) {
          const linked = setImmersionImageId(result.id, pendingId);
          if (linked) pendingImageIdRef.current = null;
        } else if (!added) {
          // 記録に載らなかった孤児画像は片付ける
          clearPendingImage();
        }
      }
      setRegistered(true);
    }
  }, [phase, result, registered]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    tap();
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleDataUrl(raw, 720);
      resetSession();
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
    resetSession();
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
    } catch (err) {
      console.error("[monomon] 画像保存に失敗:", err);
      toast.error("うまく保存できなかったよ　もう一度ためしてみてね");
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
          <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full gradient-magic shadow-glow animate-breathe">
            <Camera className="h-14 w-14 text-card" strokeWidth={1.6} />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            モノを撮ってみよう
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            身の回りのモノを1枚
            <br />
            どんな精霊が出てくるかな？
          </p>

          <div className="mt-10 w-full max-w-sm space-y-1 text-center">
            <p className="text-sm font-bold text-foreground/90">
              モノ全体が入るように撮ってね
            </p>
            <p className="text-xs text-muted-foreground">
              ぬいぐるみ・文房具・植物がおすすめ！
            </p>
          </div>

          <div className="mt-4 w-full max-w-sm space-y-3">
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
              className="flex w-full items-center justify-center gap-3 rounded-full bg-card py-4 text-lg font-bold text-foreground shadow-soft active:scale-95"
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
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-card py-3.5 text-sm font-bold text-foreground shadow-soft active:scale-95"
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
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-card py-3.5 text-sm font-bold text-foreground shadow-soft active:scale-95"
              >
                <Share2 className="h-4 w-4 text-primary" />
                シェア
              </button>
              <Link
                to="/zukan"
                onClick={tap}
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-secondary py-3.5 text-sm font-bold text-secondary-foreground active:scale-95"
              >
                <Check className="h-4 w-4" />
                図鑑を見る
              </Link>
              <Link
                to="/"
                onClick={tap}
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
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
