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
import { MonomonArt } from "@/components/MonomonArt";
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
  component: ScanRoute,
});

function ScanRoute() {
  return <ScanScreen />;
}

type Phase = "choose" | "confirm" | "reveal" | "result" | "error";

export function ScanScreen() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [photo, setPhoto] = useState<string | null>(null);

  const [result, setResult] = useState<Monomon | null>(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errKind, setErrKind] = useState<GentleErrorKind>("unknown");
  // [DEV DEBUG] 発生した元エラー（temporary）
  const [errDebug, setErrDebug] = useState<unknown>(null);
  // Phase 1D: 没入画像の表示URL＆準備中フラグ
  const [immersionUrl, setImmersionUrl] = useState<string | null>(null);
  const [immersionPending, setImmersionPending] = useState(false);


  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // Phase 1D 修復:
  // - sessionPromiseRef が「今この写真に対する唯一の in-flight Promise」を保持する。
  //   同じ写真に対する重複呼び出しは同じ Promise を await し、元のエラーがそのまま伝わる。
  // - activeSessionIdRef が「今アクティブなセッションのアイデンティティ」を持つ。
  //   reset / 新しい写真 / unmount で increment し、遅れて完了した非同期処理が
  //   古いセッションに属していれば副作用を捨てる。
  const sessionRef = useRef<DiscoverySession | null>(null);
  const sessionPhotoRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<DiscoverySession> | null>(null);
  const activeSessionIdRef = useRef(0);
  const mountedRef = useRef(true);
  // Phase 1D 修復（Strict Mode ライフサイクル）:
  // React 開発 Strict Mode は effect を「setup → cleanup → setup」と即座に二重実行する。
  // 純粋 unmount と、この模擬 cleanup を見分けるため、
  //   - lifecycleEpochRef: 現在生きているライフサイクル世代
  //   - pendingDestructiveCleanupRef: setTimeout(0) で走らせる破棄予定の世代
  // を保持する。cleanup では破棄を予約するだけで、
  // 直後の setup（Strict Mode の再マウント）で世代が進んでいれば破棄はキャンセルされる。
  const lifecycleEpochRef = useRef(0);
  const pendingDestructiveCleanupRef = useRef<number | null>(null);
  // 現在表示中の Object URL を持ち、次のセットや破棄で確実に revoke する。
  const objectUrlRef = useRef<string | null>(null);
  // まだ Dex の Monomon に紐付いていない一時保存画像のID。
  // 紐付けが済んだら null にする。破棄時にこれが残っていれば orphan として削除する。
  const pendingImageIdRef = useRef<string | null>(null);
  // 同じ完了イベントで meetMonomon() を二重に呼ばないためのガード。
  const completedForResultRef = useRef<string | null>(null);

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
      // Dex に紐付いていない孤児画像だけを削除する。
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

  // 画面を去るとき（真の unmount のとき）だけ、セッションを無効化し
  // Object URL・孤児画像を片付ける。Strict Mode の模擬 cleanup では破棄しない。
  useEffect(() => {
    // setup：直前の cleanup が予約した破棄をキャンセルし、世代を進める。
    mountedRef.current = true;
    pendingDestructiveCleanupRef.current = null;
    const epoch = ++lifecycleEpochRef.current;
    return () => {
      mountedRef.current = false;
      // 破棄は同期で行わず、次のマイクロタスク以降に「本当に unmount のままか」を確かめてから実施する。
      pendingDestructiveCleanupRef.current = epoch;
      setTimeout(() => {
        // Strict Mode の再 setup が走っていれば pending は null になっている or epoch が進んでいる。
        if (pendingDestructiveCleanupRef.current !== epoch) return;
        if (lifecycleEpochRef.current !== epoch) return;
        pendingDestructiveCleanupRef.current = null;
        activeSessionIdRef.current += 1;
        sessionRef.current = null;
        sessionPhotoRef.current = null;
        sessionPromiseRef.current = null;
        revokeObjectUrl();
        clearPendingImage();
      }, 0);
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
      // ユーザーの明示的リトライ：前回の rejected セッションを破棄して新しく試す。
      invalidateSession();
      setResult(null);
      completedForResultRef.current = null;
      setPhase("reveal");
    } else {
      resetSession();
      setResult(null);
      setPhoto(null);
      completedForResultRef.current = null;
      setPhase("choose");
    }
  };

  /** 現在のセッションを論理的に無効化する（in-flight は続くが結果は捨てる）。 */
  const invalidateSession = () => {
    activeSessionIdRef.current += 1;
    sessionRef.current = null;
    sessionPhotoRef.current = null;
    sessionPromiseRef.current = null;
    setImmersionPending(false);
  };

  const resetSession = () => {
    invalidateSession();
    setImmersionUrl(null);
    revokeObjectUrl();
    clearPendingImage();
  };

  /**
   * 既に保存されている没入画像を IndexedDB から復元して表示する（AI呼び出しゼロ）。
   * 見つからない・読めない場合は静かに諦め、SVG にフォールバックする。
   * Dex のリンクは触らない（IndexedDB 側の一時的な失敗で紐付けを消さない）。
   */
  const restoreStoredImmersion = async (
    imageId: string,
    sessionId: number,
  ) => {
    try {
      const stored = await getImmersionImage(imageId);
      if (activeSessionIdRef.current !== sessionId) return;
      if (!stored?.blob) return;
      revokeObjectUrl();
      const url = URL.createObjectURL(stored.blob);
      objectUrlRef.current = url;
      if (mountedRef.current) {
        setImmersionUrl(url);
      }

    } catch {
      /* 表示は諦めるが Dex のリンクは残す */
    }
  };

  /**
   * Phase 1D: recognition と image generation を1回だけ発火するセッションを取得。
   * 同じ写真に対する重複呼び出しは同一 Promise を共有し、元のエラー（DiscoveryError 等）を
   * そのまま rethrow する。ポーリングや session-lost ラップは行わない。
   */
  const ensureSession = (currentPhoto: string): Promise<Monomon> => {
    // 同じ写真の既解決セッションはそのまま返す
    if (
      sessionRef.current &&
      sessionPhotoRef.current === currentPhoto
    ) {
      return Promise.resolve(sessionRef.current.monomon);
    }
    // 同じ写真の in-flight があれば、その Promise チェーンを共有する
    if (sessionPromiseRef.current && sessionPhotoRef.current === currentPhoto) {
      return sessionPromiseRef.current.then((s) => s.monomon);
    }

    // 異なる写真の in-flight があれば古いセッションを論理的に無効化する
    if (sessionPhotoRef.current && sessionPhotoRef.current !== currentPhoto) {
      invalidateSession();
    }

    const sessionId = ++activeSessionIdRef.current;
    sessionPhotoRef.current = currentPhoto;
    const p = beginDiscovery(currentPhoto);
    sessionPromiseRef.current = p;

    // このセッション用の副作用（immersion タスクの回収、状態更新）を仕込む。
    // ただし途中で invalidate されたら状態や保存は一切行わない。
    p.then(
      (session: DiscoverySession) => {
        if (activeSessionIdRef.current !== sessionId) return;
        sessionRef.current = session;

        // (A) 既に保存された画像がある（reused 個体を含む）なら復元する
        const existingImageId = session.monomon.immersionImageId;
        if (existingImageId) {
          void restoreStoredImmersion(existingImageId, sessionId);
        }

        // (B) 新規発見なら image generation の完了を待って保存
        if (session.immersionTask) {
          if (mountedRef.current) {
            setImmersionPending(true);
          }
          void session.immersionTask
            .then(async (res) => {
              if (!res.ok) return;
              let imageId: string;
              try {
                imageId = await persistPreparedImmersion(
                  session.monomon.id,
                  res.compressed,
                );
              } catch {
                /* 保存失敗はSVGにフォールバック */
                return;
              }
              // 所有権判定は Dex を真実源にする（activeSessionId ではなく）。
              // Scan 画面が unmount 済みでも、Dex に対象 Monomon が既に登録されて
              // いれば所有者が確定しているので必ずリンクする。
              const existing = getMonomon(session.monomon.id);
              if (existing) {
                const linked = setImmersionImageId(
                  session.monomon.id,
                  imageId,
                );
                if (!linked) {
                  // Dex から消えた等の想定外のみ孤児として削除
                  void deleteImmersionImage(imageId).catch(() => {});
                } else {
                  pendingImageIdRef.current = null;
                  // 表示復元はセッションが生きているときだけ行う
                  if (activeSessionIdRef.current === sessionId) {
                    void restoreStoredImmersion(imageId, sessionId);
                  }
                }
              } else if (activeSessionIdRef.current === sessionId) {
                // まだ Dex 登録前 かつ セッション生存中：
                // completeDiscovery が拾えるように pending として保持
                pendingImageIdRef.current = imageId;
                void restoreStoredImmersion(imageId, sessionId);
              } else {
                // Dex 未登録 かつ セッションも失効：
                // 今後この画像を参照する経路が存在しないので孤児として削除
                void deleteImmersionImage(imageId).catch(() => {});
              }
            })
            .finally(() => {
              // pending 表示のクリアは UI 状態のみ。セッション生存時のみ触る。
              if (activeSessionIdRef.current !== sessionId) return;
              if (mountedRef.current) {
                setImmersionPending(false);
              }
            });

        }
      },
      () => {
        // 拒否は呼び出し側が処理する。ここではセッション状態だけ片付ける。
        if (activeSessionIdRef.current !== sessionId) return;
        if (sessionPromiseRef.current === p) {
          sessionPromiseRef.current = null;
        }
        sessionPhotoRef.current = null;
      },
    );

    return p.then((s: DiscoverySession) => s.monomon);
  };


  /**
   * 発見成功の明示的なフィニッシュ手続き。
   * Dex 登録・meetMonomon・保存済み画像のリンク・状態遷移をこの1関数で決定的に行う。
   */
  const completeDiscovery = (monomon: Monomon) => {
    // 同じ Monomon.id で二重に走らないようガード
    if (completedForResultRef.current === monomon.id) {
      setResult(monomon);
      setPhase("result");
      return;
    }
    completedForResultRef.current = monomon.id;

    addToDex(monomon);
    meetMonomon(monomon.id);

    // 先に保存が終わっていた場合はここでリンクする
    const pendingId = pendingImageIdRef.current;
    if (pendingId) {
      const linked = setImmersionImageId(monomon.id, pendingId);
      if (linked) {
        pendingImageIdRef.current = null;
      }
    }

    // 既に immersionImageId を持っている（reused）場合の表示復元は
    // ensureSession() 側で走っている。ここでは何もしない。

    setResult(monomon);
    setPhase("result");
  };




  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    tap();
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleDataUrl(raw, 720);
      resetSession();
      completedForResultRef.current = null;
      setPhoto(small);
      setResult(null);
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
    completedForResultRef.current = null;
    setPhase("reveal");
  };

  const reset = () => {
    tap();
    resetSession();
    setResult(null);
    setPhoto(null);
    completedForResultRef.current = null;
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
    <div className="relative flex min-h-[100svh] flex-col bg-day-room px-6 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* 部屋の窓光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-70"
        style={{
          background:
            "radial-gradient(90% 60% at 20% 0%, oklch(0.98 0.06 80 / 0.9), transparent 60%)",
        }}
      />

      {/* ヘッダー */}
      {phase !== "reveal" && (
        <header className="relative flex items-center">
          {phase === "result" ? (
            <button
              onClick={reset}
              className="flex h-10 w-10 items-center justify-center rounded-full glass-day text-foreground shadow-soft active:scale-95"
              aria-label="戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              to="/"
              onClick={tap}
              className="flex h-10 w-10 items-center justify-center rounded-full glass-day text-foreground shadow-soft active:scale-95"
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
        <div className="relative m-auto flex w-full flex-col items-center justify-center py-4 text-center">
          {/* 中央の巨大な撮影ボタン（視線が自然に集まる） */}
          <div className="relative mb-8">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-full warm-glow animate-breathe"
            />
            <button
              onClick={openCamera}
              className="relative flex h-36 w-36 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-float active:scale-95"
              aria-label="写真を撮る"
            >
              <Camera className="h-16 w-16" strokeWidth={1.8} />
            </button>
          </div>

          <h1 className="text-2xl font-extrabold text-foreground">
            モノを撮ってみよう
          </h1>
          <p className="mt-2 max-w-xs text-[13px] font-medium leading-relaxed text-muted-foreground">
            身の回りのモノを1枚撮ると
            <br />
            どんな精霊が出てくるかな？
          </p>

          {/* おすすめのモノ（生活空間に溶け込むチップ） */}
          <div className="mt-8 w-full max-w-sm rounded-[24px] glass-day p-4 shadow-soft">
            <p className="mb-3 text-left text-xs font-extrabold text-foreground/70">
              おすすめのモノ
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { e: "🧸", l: "ぬい" },
                { e: "✏️", l: "文具" },
                { e: "🌿", l: "植物" },
                { e: "🍵", l: "食器" },
                { e: "···", l: "その他" },
              ].map((c) => (
                <div
                  key={c.l}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-white/70 py-2 text-foreground shadow-soft"
                >
                  <span className="text-xl leading-none">{c.e}</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{c.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 撮る / 選ぶ（役割の違いを明確に） */}
          <div className="mt-6 w-full max-w-sm space-y-3">
            <button
              onClick={openCamera}
              className="flex w-full items-center justify-center gap-3 rounded-full gradient-primary py-4 text-[15px] font-bold text-primary-foreground shadow-float active:scale-95"
            >
              <Camera className="h-5 w-5" />
              写真を撮る
            </button>
            <button
              onClick={() => {
                tap();
                libraryRef.current?.click();
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full glass-day py-4 text-[15px] font-bold text-foreground shadow-soft active:scale-95"
            >
              <ImagePlus className="h-5 w-5 text-primary" />
              写真を選ぶ
            </button>
          </div>
        </div>
      )}

      {phase === "confirm" && photo && (
        <div className="relative m-auto flex w-full flex-col items-center justify-center py-6 text-center">
          {/* 撮った写真を主役にした大きな角丸カード */}
          <div className="animate-pop-in">
            <div className="relative mx-auto aspect-[3/4] w-72 overflow-hidden rounded-[36px] shadow-float">
              <img src={photo} alt="撮影した写真" className="h-full w-full object-cover" />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[36px] ring-1 ring-inset ring-white/50"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[36px] bg-gradient-to-b from-white/30 to-transparent"
              />
            </div>
          </div>

          <div className="mt-8 space-y-1.5">
            <h1 className="text-2xl font-extrabold text-foreground">この写真でさがす？</h1>
            <p className="text-[13px] font-medium text-muted-foreground">
              モノモンがかくれているかも
            </p>
          </div>

          <div className="mt-9 flex w-full max-w-sm items-center gap-3">
            <button
              onClick={() => { tap(); openCamera(); }}
              className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full glass-day py-4 text-[14px] font-bold text-foreground shadow-soft active:scale-95"
            >
              <Camera className="h-4 w-4" />
              撮り直す
            </button>
            <button
              onClick={startSearch}
              className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full gradient-primary py-4 text-[14px] font-bold text-primary-foreground shadow-float active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              モノモンを探す
            </button>
          </div>
        </div>
      )}

      {phase === "reveal" && photo && (
        <DiscoveryReveal
          photo={photo}
          generate={() => ensureSession(photo)}
          onDone={(m) => completeDiscovery(m)}
          onError={(kind, err) => {
            setErrKind(kind);
            setErrDebug(err ?? null);
            setPhase("error");
          }}
          onCancel={reset}
          immersionImageUrl={immersionUrl}
        />
      )}


      {phase === "error" && (
        <GentleError kind={errKind} onRetry={retry} debugError={errDebug} />
      )}


      {phase === "result" && result && (
        <div className="relative flex flex-1 flex-col items-center px-2 pb-6">
          {/* 上部：また会えたね ピル */}
          <div className="relative z-10 mt-1 flex w-full items-start justify-center">
            <span className="inline-flex animate-pop-in items-center gap-1.5 rounded-full bg-white/85 px-4 py-1.5 text-sm font-extrabold text-primary shadow-float backdrop-blur">
              <Sparkles className="h-4 w-4" />
              また 会えたね
            </span>
          </div>

          {/* 「〇〇に宿る」＋名前 */}
          <div className="relative z-10 mt-6 animate-rise-in text-center">
            <p className="text-xs font-bold text-foreground/60">
              {result.objectLabel
                ? result.uncertain
                  ? `${result.objectLabel}の仲間かも`
                  : `${result.objectLabel}に宿る`
                : "小さな精霊"}
            </p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-foreground">
              {result.name}
            </h1>
          </div>

          {/* 中央の大きなキャラ（暖かな台座グロー） */}
          <div className="relative my-4 flex flex-1 items-center justify-center">
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, oklch(0.9 0.12 70 / 0.55), transparent 70%)",
                filter: "blur(6px)",
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 bottom-[18%] h-3 w-48 -translate-x-1/2 rounded-full bg-amber-200/60 blur-md"
            />
            <div className="relative h-72 w-72 animate-life-float drop-shadow-[0_18px_28px_rgba(120,70,40,0.32)]">
              {immersionUrl ? (
                <img
                  src={immersionUrl}
                  alt={result.name}
                  className="h-full w-full animate-pop-in object-contain"
                />
              ) : (
                <MonomonArt monomon={result} />
              )}
            </div>
            {immersionPending && !immersionUrl && (
              <span className="absolute bottom-[6%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-foreground/70 backdrop-blur">
                写真の中に姿をあらわしているよ…
              </span>
            )}
          </div>

          {/* 一言（白いカード） */}
          <div className="relative z-10 mx-4 mb-5 max-w-sm animate-pop-in rounded-3xl bg-white/85 px-5 py-3 text-center text-[15px] font-bold leading-relaxed text-foreground shadow-float backdrop-blur">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 mr-1.5 text-[11px] font-extrabold text-primary">
              {result.personality}
            </span>
            <span>「{result.description}」</span>
          </div>

          {/* 下部：ふたつのボタン（くわしく見る／図鑑に入れる） */}
          <div className="relative z-10 grid w-full max-w-sm grid-cols-2 gap-3 px-2">
            <Link
              to="/zukan"
              onClick={tap}
              className="flex items-center justify-center gap-2 rounded-full bg-white/85 py-3.5 text-sm font-bold text-foreground shadow-soft backdrop-blur active:scale-95"
            >
              くわしく見る
            </Link>
            <button
              onClick={() => {
                tap();
                setSharing(true);
              }}
              className="flex items-center justify-center gap-2 rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-float active:scale-95"
            >
              <Check className="h-4 w-4" />
              図鑑に入れる
            </button>
          </div>

          {/* 補助アクション（保存・シェア・ホーム） */}
          <div className="relative z-10 mt-3 flex w-full max-w-sm items-center justify-center gap-2 px-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/60 py-2.5 text-xs font-bold text-foreground/80 backdrop-blur active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              保存
            </button>
            <button
              onClick={() => { tap(); setSharing(true); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/60 py-2.5 text-xs font-bold text-foreground/80 backdrop-blur active:scale-95"
            >
              <Share2 className="h-3.5 w-3.5" />
              シェア
            </button>
            <Link
              to="/"
              onClick={tap}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/60 py-2.5 text-xs font-bold text-foreground/80 backdrop-blur active:scale-95"
            >
              <Home className="h-3.5 w-3.5" />
              ホーム
            </Link>
          </div>

          <div className="relative z-10 mt-3">
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
