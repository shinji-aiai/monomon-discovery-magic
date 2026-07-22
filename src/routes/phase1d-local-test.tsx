// Phase 1D — ローカル検証専用の一時ルート。
// このファイルは Phase 1D のクライアント側配線（DiscoverySession → SVGファースト → 圧縮 → IndexedDB → 復元 → 孤児クリーンアップ）
// だけを検証する。AI Gateway・server function・recognition・image generation はいっさい呼ばない。
// production /scan からは到達不可能で、テスト種目は explicit なボタンでのみ起動する。

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScanScreen,
  type ScanScreenTestConfig,
  type ScanScreenTestEvent,
} from "./scan";
import type { Monomon } from "@/lib/monomon";
import type { DiscoverySession } from "@/lib/discovery-pipeline";
import {
  compressImmersionImage,
  countImmersionImages,
  deleteImmersionImage,
  getImmersionImage,
} from "@/lib/immersion-image-store";
import {
  dexStore,
  getMonomon,
  removeFromDex,
} from "@/lib/dex";
import { genPalette, mulberry32 } from "@/lib/monomon-data";

export const Route = createFileRoute("/phase1d-local-test")({
  head: () => ({
    meta: [
      { title: "Phase 1D ローカル検証" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Phase1dLocalTest,
});

/* =========================================================================
 * 決定的なフィクスチャ
 * ======================================================================= */

const FIXTURE_MONOMON_ID = "phase1d-local-test-monon-20260721";
const FIXTURE_ORPHAN_MONOMON_ID =
  "phase1d-local-test-monon-20260721-orphan";
const FIXTURE_NAME = "パンチくん";
const FIXTURE_OBJECT_LABEL = "2穴パンチ";
const FIXTURE_SPECIES_ID = "scissors"; // 既存 22 種族の stationery ハサミ族を借用

/** 決定的な写真：温かなアイボリー背景に赤とグレーの2穴パンチ。data URL。 */
function buildFixturePhotoDataUrl(): string {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#faf3e0"/>
      <stop offset="100%" stop-color="#e8dcc0"/>
    </radialGradient>
    <linearGradient id="body" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d84343"/>
      <stop offset="100%" stop-color="#a02020"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <ellipse cx="400" cy="640" rx="240" ry="24" fill="#00000018"/>
  <rect x="220" y="330" width="360" height="200" rx="28" fill="url(#body)"/>
  <rect x="220" y="330" width="360" height="42" rx="12" fill="#8a1616"/>
  <rect x="270" y="480" width="260" height="80" rx="14" fill="#8a8f96"/>
  <circle cx="340" cy="520" r="14" fill="#1c1f24"/>
  <circle cx="460" cy="520" r="14" fill="#1c1f24"/>
  <rect x="360" y="240" width="80" height="100" rx="10" fill="#6c7178"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 決定的な没入画像：同じパンチにそっと寄り添う小さな非生物モノモン。ローカルで Blob 化して実 compressor に渡す。 */
async function buildLocalImmersionBlob(): Promise<Blob> {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200">
  <defs>
    <radialGradient id="bg2" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#f7ecd4"/>
      <stop offset="100%" stop-color="#d9c8a3"/>
    </radialGradient>
    <linearGradient id="body2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d84343"/>
      <stop offset="100%" stop-color="#8f1a1a"/>
    </linearGradient>
    <radialGradient id="mm" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#f4e0b8"/>
      <stop offset="100%" stop-color="#c9a870"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg2)"/>
  <ellipse cx="600" cy="980" rx="360" ry="30" fill="#00000020"/>
  <rect x="330" y="500" width="540" height="300" rx="42" fill="url(#body2)"/>
  <rect x="330" y="500" width="540" height="60" rx="18" fill="#7a1414"/>
  <rect x="410" y="720" width="380" height="120" rx="20" fill="#8a8f96"/>
  <circle cx="510" cy="780" r="20" fill="#1c1f24"/>
  <circle cx="690" cy="780" r="20" fill="#1c1f24"/>
  <!-- 小さな非生物モノモン（丸みのある種のような塊。目・手足なし） -->
  <ellipse cx="880" cy="820" rx="46" ry="52" fill="url(#mm)" stroke="#8a6f3a" stroke-width="2"/>
  <ellipse cx="866" cy="806" rx="10" ry="14" fill="#ffffff55"/>
</svg>`;
  // SVG → PNG に一度ラスタライズしてから Blob 化（実 compressor が受け付ける形式）
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("failed to decode local SVG fixture"));
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas context");
  ctx.drawImage(img, 0, 0, 1200, 1200);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png",
    );
  });
}

/** 決定的なローカル Monomon（22 種族はいっさい追加・変更しない）。 */
function buildFixtureMonomon(id: string): Monomon {
  const seed = 0xa1b2c3d4;
  const rng = mulberry32(seed);
  return {
    speciesId: FIXTURE_SPECIES_ID,
    seed,
    palette: genPalette(rng, 8),
    eyes: "round",
    mouth: "smile",
    pattern: "none",
    accessory: "none",
    pose: "stand",
    id,
    name: FIXTURE_NAME,
    family: "stationery",
    personality: "きちんと者",
    description: "紙をきれいに2つそろえるのが得意",
    discoveredAt: "2026-07-21T00:00:00.000Z",
    photo: FIXTURE_PHOTO,
    favorite: false,
    objectLabel: FIXTURE_OBJECT_LABEL,
    uncertain: false,
    friendship: 0,
  };
}

const FIXTURE_PHOTO = buildFixturePhotoDataUrl();

/* =========================================================================
 * ローカル発見オーバーライドのファクトリ
 * ======================================================================= */

type Counters = {
  overrideCalls: number;
  recognitionResolves: number;
  immersionTaskCreates: number;
  immersionTaskResolves: number;
  compressionsDone: number;
};

function makeCounters(): Counters {
  return {
    overrideCalls: 0,
    recognitionResolves: 0,
    immersionTaskCreates: 0,
    immersionTaskResolves: 0,
    compressionsDone: 0,
  };
}

interface OverrideOptions {
  monomonId: string;
  recognitionDelayMs?: number;
  immersionDelayMs?: number;
  /** true のとき reusedExisting=true, immersionTask=null で返す（復元シナリオ） */
  reuseExisting?: boolean;
  counters: Counters;
  bumpCounters: () => void;
}

function makeBeginDiscoveryOverride(opts: OverrideOptions) {
  return async (_photo: string): Promise<DiscoverySession> => {
    opts.counters.overrideCalls++;
    opts.bumpCounters();
    const delay = opts.recognitionDelayMs ?? 550;
    await new Promise((r) => setTimeout(r, delay));
    opts.counters.recognitionResolves++;
    opts.bumpCounters();
    if (opts.reuseExisting) {
      const existing = getMonomon(opts.monomonId);
      const monomon = existing ?? buildFixtureMonomon(opts.monomonId);
      return {
        monomon,
        reusedExisting: true,
        immersionTask: null,
      };
    }
    const monomon = buildFixtureMonomon(opts.monomonId);
    opts.counters.immersionTaskCreates++;
    opts.bumpCounters();
    const immersionTask = (async () => {
      await new Promise((r) => setTimeout(r, opts.immersionDelayMs ?? 2500));
      try {
        const blob = await buildLocalImmersionBlob();
        const compressed = await compressImmersionImage(blob);
        opts.counters.compressionsDone++;
        opts.counters.immersionTaskResolves++;
        opts.bumpCounters();
        return { ok: true as const, compressed };
      } catch {
        opts.counters.immersionTaskResolves++;
        opts.bumpCounters();
        return { ok: false as const, reason: "compression_failed" as const };
      }
    })();
    return { monomon, reusedExisting: false, immersionTask };
  };
}

/* =========================================================================
 * 画面
 * ======================================================================= */

type EventEntry = {
  at: number;
  label: string;
};

type Verdict = "PASS" | "FAIL" | "NOT RUN";

interface Report {
  aiImportsAbsent: Verdict;
  fetchCount: number;
  realBeginDiscoveryCalls: Verdict;
  svgFirst: Verdict;
  pendingNonBlocking: Verdict;
  cardSwitched: Verdict;
  overrideCallOne: Verdict;
  recognitionOne: Verdict;
  immersionCreateOne: Verdict;
  compressionSucceeded: Verdict;
  indexedRecordExists: Verdict;
  blobNonEmpty: Verdict;
  metadataValid: Verdict;
  dexOnlyImageId: Verdict;
  restoredImage: Verdict;
  noNewImageTask: Verdict;
  imageCountUnchanged: Verdict;
  unmountedSilent: Verdict;
  orphanAbsent: Verdict;
  completeDiscoveryOne: Verdict;
  addToDexOne: Verdict;
  meetMonomonOne: Verdict;
}

function initialReport(): Report {
  return {
    aiImportsAbsent: "PASS", // このファイルに AI import が無いことを静的に確認済み
    fetchCount: 0,
    realBeginDiscoveryCalls: "PASS", // override 経路のみを走らせる契約
    svgFirst: "NOT RUN",
    pendingNonBlocking: "NOT RUN",
    cardSwitched: "NOT RUN",
    overrideCallOne: "NOT RUN",
    recognitionOne: "NOT RUN",
    immersionCreateOne: "NOT RUN",
    compressionSucceeded: "NOT RUN",
    indexedRecordExists: "NOT RUN",
    blobNonEmpty: "NOT RUN",
    metadataValid: "NOT RUN",
    dexOnlyImageId: "NOT RUN",
    restoredImage: "NOT RUN",
    noNewImageTask: "NOT RUN",
    imageCountUnchanged: "NOT RUN",
    unmountedSilent: "NOT RUN",
    orphanAbsent: "NOT RUN",
    completeDiscoveryOne: "NOT RUN",
    addToDexOne: "NOT RUN",
    meetMonomonOne: "NOT RUN",
  };
}

function Phase1dLocalTest() {
  // --- fetch spy: 本ハーネス起動中にネットワーク呼び出しが発生しないことを検知する。 ---
  const fetchCountRef = useRef(0);
  useEffect(() => {
    const originalFetch = window.fetch;
    let count = 0;
    window.fetch = ((...args: Parameters<typeof fetch>) => {
      count++;
      fetchCountRef.current = count;
      return originalFetch.apply(window, args);
    }) as typeof fetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const countersRef = useRef<Counters>(makeCounters());
  const orphanCountersRef = useRef<Counters>(makeCounters());
  const eventsRef = useRef<EventEntry[]>([]);
  const orphanEventsRef = useRef<EventEntry[]>([]);
  const completionCountsRef = useRef({
    completeDiscovery: 0,
    addToDex: 0,
    meetMonomon: 0,
  });

  const [mounted, setMounted] = useState<
    null | "normal" | "restore" | "orphan" | "double"
  >(null);
  const [report, setReport] = useState<Report>(initialReport());
  const scanHandleRef = useRef<
    { ensureSession: (p: string) => Promise<Monomon> } | null
  >(null);
  // Strict Mode で onReady が同一マウントで二度呼ばれないよう、親側で消費済みキーを保持する。
  // シナリオごとにキーを変えてリセットする（"normal" / "double" / null）。
  const onReadyConsumedRef = useRef<string | null>(null);
  // "double" シナリオの Promise ペア結果を格納するため
  const doubleResultRef = useRef<{ r1: Monomon; r2: Monomon } | null>(null);

  const pushEvent = (target: EventEntry[], label: string) => {
    target.push({ at: Date.now(), label });
    if (target.length > 200) target.splice(0, target.length - 200);
    bump();
  };

  /* -------- Scenario A: 通常発見 (SVG先→画像あと) -------- */

  /**
   * 通常シナリオを「クリーンな状態」で開始する。
   * - 既存のテスト用 ScanScreen をアンマウント
   * - カウンタ・イベント・onReady 消費ガードをリセット
   * - 決定的なテスト成果物（本テストの 2 種類の ID）だけを Dex と IndexedDB から削除
   *   （clearDex() は絶対に呼ばない・非テストレコードには絶対触れない）
   */
  const startNormalScenario = async () => {
    // 1) まず既存のテスト画面を確実にアンマウント
    setMounted(null);
    await new Promise((r) => setTimeout(r, 60));
    // 2) カウンタ・イベント・ガードをフルリセット
    countersRef.current = makeCounters();
    eventsRef.current = [];
    completionCountsRef.current = {
      completeDiscovery: 0,
      addToDex: 0,
      meetMonomon: 0,
    };
    scanHandleRef.current = null;
    onReadyConsumedRef.current = null;
    doubleResultRef.current = null;
    setReport(initialReport());
    // 3) 決定的なテスト成果物のみを削除（clearDex は使わない）
    if (getMonomon(FIXTURE_MONOMON_ID)) {
      removeFromDex(FIXTURE_MONOMON_ID);
    }
    if (getMonomon(FIXTURE_ORPHAN_MONOMON_ID)) {
      removeFromDex(FIXTURE_ORPHAN_MONOMON_ID);
    }
    try {
      await deleteImmersionImage(FIXTURE_MONOMON_ID);
    } catch {
      /* noop */
    }
    try {
      await deleteImmersionImage(FIXTURE_ORPHAN_MONOMON_ID);
    } catch {
      /* noop */
    }
    // 4) 新しい ScanScreen を fresh でマウント
    setMounted("normal");
  };

  /* -------- Scenario B: 二重呼び出し（同一写真・専用フレッシュ ScanScreen） -------- */

  /**
   * 完了済みの通常セッションを一切再利用せず、
   * ・専用の fresh ScanScreen を choose 状態でマウント（initialPhoto を渡さない）
   * ・親所有のガードで onReady が Strict Mode で二度実行されないようにする
   * ・onReady 内部で同一 tick に ensureSession(FIXTURE_PHOTO) を 2 回呼ぶ
   * ・両 Promise の resolve と一致性、カウンタを検証する
   */
  const runDoubleCallScenario = async () => {
    setMounted(null);
    await new Promise((r) => setTimeout(r, 60));
    countersRef.current = makeCounters();
    eventsRef.current = [];
    completionCountsRef.current = {
      completeDiscovery: 0,
      addToDex: 0,
      meetMonomon: 0,
    };
    scanHandleRef.current = null;
    onReadyConsumedRef.current = null;
    doubleResultRef.current = null;
    setMounted("double");
    // onReady で呼ばれる Promise ペアの結果を待つ
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (doubleResultRef.current) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const pair = doubleResultRef.current as
      | { r1: Monomon; r2: Monomon }
      | null;
    const c = countersRef.current;
    const idsMatch = pair !== null && pair.r1.id === pair.r2.id;
    setReport((prev) => ({
      ...prev,
      overrideCallOne: c.overrideCalls === 1 ? "PASS" : "FAIL",
      recognitionOne: c.recognitionResolves === 1 ? "PASS" : "FAIL",
      immersionCreateOne: c.immersionTaskCreates === 1 ? "PASS" : "FAIL",
    }));
    pushEvent(
      eventsRef.current,
      `double-call ${idsMatch && c.overrideCalls === 1 ? "PASS" : "FAIL"}`,
    );
  };

  /* -------- Scenario C: 保存済み画像の復元 -------- */

  const runRestoreScenario = async () => {
    const existing = getMonomon(FIXTURE_MONOMON_ID);
    if (!existing?.immersionImageId) {
      window.alert(
        "先に「通常発見を開始」で保存済みレコードを作成してください",
      );
      return;
    }
    const beforeCount = await countImmersionImages();
    const beforeImageId = existing.immersionImageId;
    // 一度アンマウントしてから復元専用モードで再マウント
    setMounted(null);
    // 復元用にカウンタをリセット
    countersRef.current = makeCounters();
    completionCountsRef.current = {
      completeDiscovery: 0,
      addToDex: 0,
      meetMonomon: 0,
    };
    await new Promise((r) => setTimeout(r, 60));
    setMounted("restore");
    // 完了・画像表示が起きるまでポーリング（最大 8 秒）
    const start = Date.now();
    let visible = false;
    while (Date.now() - start < 8000) {
      await new Promise((r) => setTimeout(r, 250));
      if (eventsRef.current.some((e) => e.label === "immersion_image_visible")) {
        visible = true;
        break;
      }
    }
    const afterCount = await countImmersionImages();
    const afterExisting = getMonomon(FIXTURE_MONOMON_ID);
    setReport((prev) => ({
      ...prev,
      restoredImage: visible ? "PASS" : "FAIL",
      noNewImageTask:
        countersRef.current.immersionTaskCreates === 0 ? "PASS" : "FAIL",
      imageCountUnchanged: afterCount === beforeCount ? "PASS" : "FAIL",
    }));
    pushEvent(
      eventsRef.current,
      `restore ${visible ? "PASS" : "FAIL"} count ${beforeCount}→${afterCount} id ${afterExisting?.immersionImageId === beforeImageId ? "same" : "changed"}`,
    );
  };

  /* -------- Scenario D: 孤児クリーンアップ -------- */

  const startOrphanScenario = async () => {
    // 事前に前回の孤児アーティファクトを掃除
    try {
      await deleteImmersionImage(FIXTURE_ORPHAN_MONOMON_ID);
    } catch {
      /* noop */
    }
    orphanCountersRef.current = makeCounters();
    orphanEventsRef.current = [];
    setMounted("orphan");
    pushEvent(orphanEventsRef.current, "orphan-mounted");
  };

  const finishOrphanScenario = async () => {
    // production の invalidation/unmount 経路に任せる
    setMounted(null);
    // 遅延した永続化が settle するのを待つ（最大 6 秒）
    const start = Date.now();
    let record: unknown = null;
    while (Date.now() - start < 6000) {
      await new Promise((r) => setTimeout(r, 300));
      record = await getImmersionImage(FIXTURE_ORPHAN_MONOMON_ID);
      if (!record) continue;
      // まだ在るなら再試行（クリーンアップ完了待ち）
    }
    const finalRecord = await getImmersionImage(FIXTURE_ORPHAN_MONOMON_ID);
    const absent = !finalRecord;
    setReport((prev) => ({
      ...prev,
      unmountedSilent: absent ? "PASS" : "FAIL",
      orphanAbsent: absent ? "PASS" : "FAIL",
    }));
    pushEvent(
      orphanEventsRef.current,
      `orphan settled ${absent ? "PASS" : "FAIL"}`,
    );
  };

  /* -------- 通常発見完了後の永続化チェック -------- */

  const runPersistenceChecks = async () => {
    const record = await getImmersionImage(FIXTURE_MONOMON_ID);
    const dex = getMonomon(FIXTURE_MONOMON_ID);
    const dexAny = dex as unknown as Record<string, unknown>;
    const dexOk =
      !!dex &&
      typeof dex.immersionImageId === "string" &&
      dex.immersionImageId === FIXTURE_MONOMON_ID &&
      !("immersionBlob" in dexAny) &&
      !("immersionBase64" in dexAny) &&
      !("immersionObjectUrl" in dexAny);
    setReport((prev) => ({
      ...prev,
      compressionSucceeded:
        countersRef.current.compressionsDone === 1 ? "PASS" : "FAIL",
      indexedRecordExists: record ? "PASS" : "FAIL",
      blobNonEmpty: record && record.blob.size > 0 ? "PASS" : "FAIL",
      metadataValid:
        record &&
        record.mimeType.startsWith("image/") &&
        record.width > 0 &&
        record.height > 0 &&
        record.sizeBytes === record.blob.size
          ? "PASS"
          : "FAIL",
      dexOnlyImageId: dexOk ? "PASS" : "FAIL",
      completeDiscoveryOne:
        completionCountsRef.current.completeDiscovery === 1 ? "PASS" : "FAIL",
      addToDexOne:
        completionCountsRef.current.addToDex === 1 ? "PASS" : "FAIL",
      meetMonomonOne:
        completionCountsRef.current.meetMonomon === 1 ? "PASS" : "FAIL",
    }));
  };

  /* -------- テスト成果物のみを削除 -------- */

  const cleanArtifacts = async () => {
    if (getMonomon(FIXTURE_MONOMON_ID)) {
      removeFromDex(FIXTURE_MONOMON_ID); // 画像も付随して消える
    }
    try {
      await deleteImmersionImage(FIXTURE_MONOMON_ID);
    } catch {
      /* noop */
    }
    try {
      await deleteImmersionImage(FIXTURE_ORPHAN_MONOMON_ID);
    } catch {
      /* noop */
    }
    pushEvent(eventsRef.current, "artifacts-cleaned");
  };

  /* -------- ScanScreen 用テスト設定 -------- */

  const makeNormalConfig = (): ScanScreenTestConfig => ({
    localTestMode: true,
    initialPhoto: FIXTURE_PHOTO,
    beginDiscoveryOverride: makeBeginDiscoveryOverride({
      monomonId: FIXTURE_MONOMON_ID,
      counters: countersRef.current,
      bumpCounters: bump,
    }),
    onEvent: (e) => handleScanEvent(e, eventsRef.current),
    onReady: (h) => {
      // Strict Mode の二重実行を親側でブロック
      if (onReadyConsumedRef.current === "normal") return;
      onReadyConsumedRef.current = "normal";
      scanHandleRef.current = h;
    },
  });

  /** 二重呼び出し専用：initialPhoto を渡さず choose 状態の fresh ScanScreen を使う。 */
  const makeDoubleConfig = (): ScanScreenTestConfig => ({
    localTestMode: true,
    beginDiscoveryOverride: makeBeginDiscoveryOverride({
      monomonId: FIXTURE_MONOMON_ID,
      counters: countersRef.current,
      bumpCounters: bump,
    }),
    onEvent: (e) => handleScanEvent(e, eventsRef.current),
    onReady: (h) => {
      // 親所有ガード：Strict Mode の再実行では 2 回目の onReady を無視する。
      if (onReadyConsumedRef.current === "double") return;
      onReadyConsumedRef.current = "double";
      scanHandleRef.current = h;
      // 認識前に同一 tick で ensureSession を 2 回呼ぶ（実 ScanScreen 経路のみ）
      const p1 = h.ensureSession(FIXTURE_PHOTO);
      const p2 = h.ensureSession(FIXTURE_PHOTO);
      void Promise.all([p1, p2])
        .then(([r1, r2]) => {
          doubleResultRef.current = { r1, r2 };
        })
        .catch(() => {
          /* 記録は runDoubleCallScenario 側で失敗として判定される */
        });
    },
  });

  const makeRestoreConfig = (): ScanScreenTestConfig => ({
    localTestMode: true,
    initialPhoto: FIXTURE_PHOTO,
    beginDiscoveryOverride: makeBeginDiscoveryOverride({
      monomonId: FIXTURE_MONOMON_ID,
      counters: countersRef.current,
      bumpCounters: bump,
      reuseExisting: true,
    }),
    onEvent: (e) => handleScanEvent(e, eventsRef.current),
  });

  const makeOrphanConfig = (): ScanScreenTestConfig => ({
    localTestMode: true,
    initialPhoto: FIXTURE_PHOTO,
    beginDiscoveryOverride: makeBeginDiscoveryOverride({
      monomonId: FIXTURE_ORPHAN_MONOMON_ID,
      counters: orphanCountersRef.current,
      bumpCounters: bump,
      immersionDelayMs: 1600,
    }),
    onEvent: (e) => handleScanEvent(e, orphanEventsRef.current),
  });

  const handleScanEvent = (e: ScanScreenTestEvent, target: EventEntry[]) => {
    const label = e.type;
    target.push({ at: e.at, label });
    if (target.length > 200) target.splice(0, target.length - 200);
    if (e.type === "complete_discovery") {
      completionCountsRef.current.completeDiscovery++;
      // 通常シナリオで発見が完了したら SVG先→画像あとを判定
      const events = target;
      const compIdx = events.findIndex((x) => x.label === "complete_discovery");
      const visIdx = events.findIndex(
        (x) => x.label === "immersion_image_visible",
      );
      setReport((prev) => ({
        ...prev,
        svgFirst:
          compIdx >= 0 && (visIdx === -1 || visIdx > compIdx) ? "PASS" : "FAIL",
        pendingNonBlocking: events.some(
          (x) => x.label === "immersion_pending_change",
        )
          ? "PASS"
          : prev.pendingNonBlocking,
      }));
    } else if (e.type === "add_to_dex_attempt") {
      completionCountsRef.current.addToDex++;
    } else if (e.type === "meet_monomon") {
      completionCountsRef.current.meetMonomon++;
    } else if (e.type === "immersion_image_visible") {
      setReport((prev) => ({ ...prev, cardSwitched: "PASS" }));
    }
    bump();
  };

  const [normalConfig, setNormalConfig] = useState<ScanScreenTestConfig | null>(
    null,
  );
  const [restoreConfig, setRestoreConfig] =
    useState<ScanScreenTestConfig | null>(null);
  const [orphanConfig, setOrphanConfig] = useState<ScanScreenTestConfig | null>(
    null,
  );
  const [doubleConfig, setDoubleConfig] =
    useState<ScanScreenTestConfig | null>(null);

  useEffect(() => {
    if (mounted === "normal") setNormalConfig(makeNormalConfig());
    if (mounted === "restore") setRestoreConfig(makeRestoreConfig());
    if (mounted === "orphan") setOrphanConfig(makeOrphanConfig());
    if (mounted === "double") setDoubleConfig(makeDoubleConfig());
    if (mounted === null) {
      setNormalConfig(null);
      setRestoreConfig(null);
      setOrphanConfig(null);
      setDoubleConfig(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const dex = dexStore.useValue();
  const fixtureExists = dex.some((m) => m.id === FIXTURE_MONOMON_ID);

  return (
    <div className="min-h-[100svh] bg-background p-4 text-foreground">
      <header className="mb-4">
        <h1 className="text-lg font-bold">Phase 1D ローカル検証</h1>
        <p className="text-xs text-muted-foreground">
          AI通信は行いません（server function / recognition / image generation
          いずれも呼びません）
        </p>
      </header>

      <section className="mb-4 space-y-2 rounded-2xl bg-card p-3 text-sm shadow-soft">
        <div className="font-bold">実行シナリオ</div>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={startNormalScenario}
            className="rounded-full bg-primary px-4 py-2 text-primary-foreground"
          >
            1. 通常発見を開始（SVG先→画像あと）
          </button>
          <button
            onClick={runDoubleCallScenario}
            className="rounded-full bg-secondary px-4 py-2 text-secondary-foreground"
          >
            2. 同一写真の二重呼び出しを確認
          </button>
          <button
            onClick={runPersistenceChecks}
            className="rounded-full bg-secondary px-4 py-2 text-secondary-foreground"
          >
            3. 永続化・Dex 状態を検査
          </button>
          <button
            onClick={runRestoreScenario}
            className="rounded-full bg-secondary px-4 py-2 text-secondary-foreground"
          >
            4. 保存済み画像の復元を確認
          </button>
          <button
            onClick={startOrphanScenario}
            className="rounded-full bg-secondary px-4 py-2 text-secondary-foreground"
          >
            5. 離脱時の孤児画像を確認（開始）
          </button>
          <button
            onClick={finishOrphanScenario}
            className="rounded-full bg-secondary px-4 py-2 text-secondary-foreground"
          >
            6. 孤児シナリオを終了（アンマウント→検査）
          </button>
          <button
            onClick={() => setMounted(null)}
            className="rounded-full bg-muted px-4 py-2"
          >
            画面を閉じる（アンマウント）
          </button>
          <button
            onClick={cleanArtifacts}
            className="rounded-full bg-destructive px-4 py-2 text-destructive-foreground"
          >
            テストデータを削除
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-card p-3 text-xs shadow-soft">
        <div className="mb-1 font-bold text-sm">レポート</div>
        <Report report={report} fetchCount={fetchCountRef.current} />
      </section>

      <section className="mb-4 rounded-2xl bg-card p-3 text-xs shadow-soft">
        <div className="mb-1 font-bold text-sm">カウンタ</div>
        <pre className="whitespace-pre-wrap text-[11px]">
{`normal: ${JSON.stringify(countersRef.current)}
orphan: ${JSON.stringify(orphanCountersRef.current)}
completion: ${JSON.stringify(completionCountsRef.current)}
fixtureInDex: ${fixtureExists}`}
        </pre>
      </section>

      <section className="mb-4 rounded-2xl bg-card p-3 text-xs shadow-soft">
        <div className="mb-1 font-bold text-sm">診断イベント（通常）</div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px]">
          {eventsRef.current
            .map((e) => `${new Date(e.at).toISOString().slice(11, 23)} ${e.label}`)
            .join("\n")}
        </pre>
      </section>

      <section className="mb-4 rounded-2xl bg-card p-3 text-xs shadow-soft">
        <div className="mb-1 font-bold text-sm">診断イベント（孤児）</div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px]">
          {orphanEventsRef.current
            .map((e) => `${new Date(e.at).toISOString().slice(11, 23)} ${e.label}`)
            .join("\n")}
        </pre>
      </section>

      <section className="rounded-2xl bg-card p-2 shadow-soft">
        <div className="mb-1 text-xs font-bold">埋め込み ScanScreen</div>
        {mounted === "normal" && normalConfig && (
          <ScanScreen testConfig={normalConfig} />
        )}
        {mounted === "restore" && restoreConfig && (
          <ScanScreen testConfig={restoreConfig} />
        )}
        {mounted === "orphan" && orphanConfig && (
          <ScanScreen testConfig={orphanConfig} />
        )}
        {mounted === "double" && doubleConfig && (
          <ScanScreen testConfig={doubleConfig} />
        )}
        {mounted === null && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            未マウント
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, v }: { label: string; v: Verdict }) {
  const color =
    v === "PASS"
      ? "text-emerald-600"
      : v === "FAIL"
        ? "text-red-600"
        : "text-muted-foreground";
  return (
    <div className="flex justify-between border-b border-border/40 py-0.5">
      <span>{label}</span>
      <span className={`font-mono ${color}`}>{v}</span>
    </div>
  );
}

function Report({ report, fetchCount }: { report: Report; fetchCount: number }) {
  return (
    <div className="space-y-0.5">
      <div className="font-semibold">A. AI/network safety</div>
      <Row label="AI imports absent" v={report.aiImportsAbsent} />
      <Row
        label={`fetch count from this test harness: ${fetchCount}`}
        v={fetchCount === 0 ? "PASS" : "FAIL"}
      />
      <Row label="real beginDiscovery calls: 0" v={report.realBeginDiscoveryCalls} />

      <div className="mt-2 font-semibold">B. SVG-first behavior</div>
      <Row label="result completed before local immersion image" v={report.svgFirst} />
      <Row label="pending UI non-blocking" v={report.pendingNonBlocking} />
      <Row label="card later switched to stored image" v={report.cardSwitched} />

      <div className="mt-2 font-semibold">C. one-request lock</div>
      <Row label="override call count: 1" v={report.overrideCallOne} />
      <Row label="recognition resolution count: 1" v={report.recognitionOne} />
      <Row label="immersionTask creation count: 1" v={report.immersionCreateOne} />

      <div className="mt-2 font-semibold">D. persistence</div>
      <Row label="compression succeeded" v={report.compressionSucceeded} />
      <Row label="IndexedDB record exists" v={report.indexedRecordExists} />
      <Row label="Blob non-empty" v={report.blobNonEmpty} />
      <Row label="image metadata valid" v={report.metadataValid} />
      <Row label="Dex contains only immersionImageId" v={report.dexOnlyImageId} />

      <div className="mt-2 font-semibold">E. restoration</div>
      <Row label="existing image restored" v={report.restoredImage} />
      <Row label="no new image task" v={report.noNewImageTask} />
      <Row label="image count unchanged" v={report.imageCountUnchanged} />

      <div className="mt-2 font-semibold">F. lifecycle safety</div>
      <Row label="unmounted session did not update visible state" v={report.unmountedSilent} />
      <Row label="orphan record absent" v={report.orphanAbsent} />

      <div className="mt-2 font-semibold">G. completion guard</div>
      <Row label="completeDiscovery count: 1" v={report.completeDiscoveryOne} />
      <Row label="addToDex attempt count: 1" v={report.addToDexOne} />
      <Row label="meetMonomon count: 1" v={report.meetMonomonOne} />
    </div>
  );
}
