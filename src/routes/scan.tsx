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
  component: ScanRoute,
});

function ScanRoute() {
  return <ScanScreen />;
}

type Phase = "choose" | "confirm" | "reveal" | "result" | "error";

/**
 * Phase 1D ローカル検証専用の狭いテスト差し込み口。
 * production /scan からは絶対に到達しない（本番は <ScanScreen /> を testConfig 無しで描画）。
 * 差し替えられるのは DiscoverySession の取得元だけで、
 * それ以外の永続化・エラー分類・Object URL 管理・Dex 挙動には触らない。
 */
export type ScanScreenTestEvent =
  | { type: "recognition_started"; at: number }
  | { type: "recognition_resolved"; at: number; monomonId: string }
  | { type: "recognition_rejected"; at: number }
  | { type: "complete_discovery"; at: number; monomonId: string }
  | { type: "add_to_dex_attempt"; at: number; monomonId: string }
  | { type: "meet_monomon"; at: number; monomonId: string }
  | { type: "immersion_image_visible"; at: number; imageId: string }
  | { type: "immersion_pending_change"; at: number; pending: boolean };

export interface ScanScreenTestConfig {
  localTestMode: true;
  initialPhoto?: string;
  beginDiscoveryOverride?: (photo: string) => Promise<DiscoverySession>;
  onEvent?: (event: ScanScreenTestEvent) => void;
  onReady?: (handle: {
    ensureSession: (photo: string) => Promise<Monomon>;
  }) => void;
}

export function ScanScreen({
  testConfig,
}: { testConfig?: ScanScreenTestConfig } = {}) {
  const testConfigRef = useRef<ScanScreenTestConfig | undefined>(testConfig);
  testConfigRef.current = testConfig;
  const emit = (e: ScanScreenTestEvent) => {
    try {
      testConfigRef.current?.onEvent?.(e);
    } catch {
      /* diagnostics must never break production */
    }
  };
  const initialPhoto = testConfig?.initialPhoto ?? null;
  const [phase, setPhase] = useState<Phase>(initialPhoto ? "reveal" : "choose");
  const [photo, setPhoto] = useState<string | null>(initialPhoto);

  const [result, setResult] = useState<Monomon | null>(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errKind, setErrKind] = useState<GentleErrorKind>("unknown");
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
        emit({
          type: "immersion_image_visible",
          at: Date.now(),
          imageId,
        });
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
    // Phase 1D ローカル検証だけが差し替えられる、非常に狭い差し込み口。
    // production /scan では testConfigRef.current が undefined なので、
    // 実行時パスは常に本番の beginDiscovery になる。
    const source =
      testConfigRef.current?.beginDiscoveryOverride ?? beginDiscovery;
    emit({ type: "recognition_started", at: Date.now() });
    const p = source(currentPhoto);
    sessionPromiseRef.current = p;

    // このセッション用の副作用（immersion タスクの回収、状態更新）を仕込む。
    // ただし途中で invalidate されたら状態や保存は一切行わない。
    p.then(
      (session) => {
        if (activeSessionIdRef.current !== sessionId) return;
        sessionRef.current = session;
        emit({
          type: "recognition_resolved",
          at: Date.now(),
          monomonId: session.monomon.id,
        });

        // (A) 既に保存された画像がある（reused 個体を含む）なら復元する
        const existingImageId = session.monomon.immersionImageId;
        if (existingImageId) {
          void restoreStoredImmersion(existingImageId, sessionId);
        }

        // (B) 新規発見なら image generation の完了を待って保存
        if (session.immersionTask) {
          if (mountedRef.current) {
            setImmersionPending(true);
            emit({
              type: "immersion_pending_change",
              at: Date.now(),
              pending: true,
            });
          }
          void session.immersionTask
            .then(async (res) => {
              if (activeSessionIdRef.current !== sessionId) return;
              if (!res.ok) return;
              try {
                const imageId = await persistPreparedImmersion(
                  session.monomon.id,
                  res.compressed,
                );
                // 保存が終わったあとにセッションが無効化されていたら、
                // その保存物は誰にも紐付かないので即座に削除する。
                if (activeSessionIdRef.current !== sessionId) {
                  void deleteImmersionImage(imageId).catch(() => {});
                  return;
                }
                // 既に Dex 登録済みならその場でリンクする
                const existing = getMonomon(session.monomon.id);
                if (existing) {
                  const linked = setImmersionImageId(
                    session.monomon.id,
                    imageId,
                  );
                  if (!linked) {
                    // Dex 登録から消えた等の想定外：孤児として削除
                    void deleteImmersionImage(imageId).catch(() => {});
                  } else {
                    pendingImageIdRef.current = null;
                    void restoreStoredImmersion(imageId, sessionId);
                  }
                } else {
                  // 完了関数側で拾えるように pending として保持
                  pendingImageIdRef.current = imageId;
                  void restoreStoredImmersion(imageId, sessionId);
                }
              } catch {
                /* 保存失敗はSVGにフォールバック */
              }
            })
            .finally(() => {
              if (activeSessionIdRef.current !== sessionId) return;
              if (mountedRef.current) {
                setImmersionPending(false);
                emit({
                  type: "immersion_pending_change",
                  at: Date.now(),
                  pending: false,
                });
              }
            });
        }
      },
      () => {
        // 拒否は呼び出し側が処理する。ここではセッション状態だけ片付ける。
        if (activeSessionIdRef.current !== sessionId) return;
        emit({ type: "recognition_rejected", at: Date.now() });
        if (sessionPromiseRef.current === p) {
          sessionPromiseRef.current = null;
        }
        sessionPhotoRef.current = null;
      },
    );

    return p.then((s) => s.monomon);
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

    emit({
      type: "complete_discovery",
      at: Date.now(),
      monomonId: monomon.id,
    });
    emit({
      type: "add_to_dex_attempt",
      at: Date.now(),
      monomonId: monomon.id,
    });
    addToDex(monomon);
    emit({ type: "meet_monomon", at: Date.now(), monomonId: monomon.id });
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

  // Phase 1D ローカル検証: 同一写真の in-flight Promise 共有を検証するため、
  // テスト側から実 ScanScreen の ensureSession を叩けるようにする。
  // production では testConfigRef.current が undefined なので何も起きない。
  useEffect(() => {
    testConfigRef.current?.onReady?.({ ensureSession });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
          generate={() => ensureSession(photo)}
          onDone={(m) => completeDiscovery(m)}
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
            <MonomonCard
              monomon={result}
              animate
              immersionImageUrl={immersionUrl}
              immersionPending={immersionPending}
            />

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
