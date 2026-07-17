import {
  ACCESSORY_POOL,
  EYE_POOL,
  MOUTH_POOL,
  PATTERN_POOL,
  POSE_POOL,
  genPalette,
  mulberry32,
  pick,
  type Family,
  type MonomonSpec,
} from "./monomon-data";
import { SPECIES_MAP, getSpecies } from "./species";
import { resolveSpecies } from "./classification";
import { analyzeSpirit } from "./monomon-ai.functions";
import { composeMonomonScene } from "./monomon-compose.functions";

export interface Monomon extends MonomonSpec {
  id: string;
  name: string;
  /** 種族の所属（カード背景の質感づけに使用） */
  family: Family;
  personality: string;
  /** 一言コメント */
  description: string;
  /** ISO日時。発見日。 */
  discoveredAt: string;
  /** 元になった写真（縮小したdata URL）。元写真は絶対に上書きしない。 */
  photo: string;
  /** お気に入り */
  favorite?: boolean;
  /** AIが認識した物体名（例：コップ、ハサミ、傘） */
  objectLabel?: string;
  /** AIの認識に自信が低い＝推定表示（「○○の仲間かもしれない」） */
  uncertain?: boolean;
  /** なかよし度（0〜100）。詳しくは friendship.ts */
  friendship?: number;
  /** 最後に会いに来た日時（ISO）。今日はじめての来訪判定に使う。 */
  lastMetAt?: string;
  /** 再会回数（会いに来た日の延べ回数）。詳しくは friendship.ts の reunion */
  reunionCount?: number;
  /**
   * 合成写真（極小のモノモンが元写真に自然に溶け込んだ1枚）が
   * IndexedDB に保存されているか。true のとき useComposedPhoto で読み出せる。
   */
  hasComposed?: boolean;
  /**
   * 合成直後だけメモリ上に載せる data URL（保存はしない・addToDex で剥がす）。
   * 発見演出と結果画面の同一セッションで即座に表示するためのもの。
   */
  composedPhoto?: string;
}

function makeId(seed: number): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mm_${seed}_${Date.now()}`;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * spec（種族 + 個体の見た目）を seed から決定的に組み立てます。
 * hueBias があれば個体の色相の中心に使います（写真の色などを反映）。
 */
export function buildSpec(
  seed: number,
  speciesId: string,
  hueBias?: number,
): MonomonSpec {
  const rng = mulberry32(seed ^ 0x85ebca6b);
  const species = getSpecies(speciesId);
  // 色相：写真の色を尊重しつつ、種族の寄せ先があれば少し混ぜる
  let hue = hueBias ?? rng() * 360;
  if (species.hueHint != null) hue = (hue + species.hueHint * 2) / 3;
  hue = (hue + (rng() - 0.5) * 30 + 360) % 360;

  return {
    speciesId,
    seed,
    palette: genPalette(rng, hue),
    eyes: pick(rng, EYE_POOL),
    mouth: pick(rng, MOUTH_POOL),
    pattern: pick(rng, PATTERN_POOL),
    accessory: pick(rng, ACCESSORY_POOL),
    pose: pick(rng, POSE_POOL),
  };
}

/** 出会いがうまくいかなかったときの種類（UIでやさしく伝える）。 */
export type DiscoveryErrorKind =
  | "network"
  | "busy"
  | "too_far"
  | "too_dark"
  | "blurry"
  | "unclear"
  | "generation_timeout"
  | "generation_failed"
  | "storage"
  | "unknown";

export type PipelineStage =
  | "PHOTO_RECEIVED"
  | "PHOTO_CONVERTED"
  | "RECOGNITION_STARTED"
  | "RECOGNITION_SUCCEEDED"
  | "COMPOSITION_REQUEST_STARTED"
  | "COMPOSITION_RESPONSE_RECEIVED"
  | "GENERATED_IMAGE_PARSED"
  | "MEMORY_SAVE_STARTED"
  | "MEMORY_SAVE_SUCCEEDED";

export interface PipelineDiagnostic {
  failedStage: PipelineStage;
  status?: number;
  model?: string;
  reason?: string;
  errorType?: string;
  elapsedMs?: number;
  inputMimeType?: string;
  inputImageBytes?: number;
}

/** 認識に十分な自信があるとみなす下限（これ未満は撮り直しを促す）。 */
const MIN_CONFIDENCE = 0.35;

/** モノモンとの出会いに失敗したことを表す（怖い画面ではなくやさしく案内するため）。 */
export class DiscoveryError extends Error {
  kind: DiscoveryErrorKind;
  diagnostic?: PipelineDiagnostic;
  constructor(kind: DiscoveryErrorKind, message: string = kind, diagnostic?: PipelineDiagnostic) {
    super(message);
    this.name = "DiscoveryError";
    this.kind = kind;
    this.diagnostic = diagnostic;
  }
}

/**
 * 写真から「モノモン（個体）」を生成します。
 *
 * AIが写真の「主役のモノ」を認識し、その物の役割・特徴に一致する精霊を
 * 組み立てます（見た目＝種族シルエット・名前・性格・説明文をすべて一致）。
 * ランダム生成はしません。AIの認識に自信が低いときは uncertain=true を返し、
 * UI 側で「○○の仲間かもしれない」と推定であることを伝えます。
 *
 * うまく出会えなかったときは DiscoveryError を投げ、UI 側でやさしく案内します。
 */
export async function generateMonomon(photo: string): Promise<Monomon> {
  const startedAt = performance.now();
  const inputMimeType = /^data:([^;,]+);base64,/.exec(photo)?.[1] ?? "unknown";
  const inputImageBytes = Math.floor(((photo.split(",")[1]?.length ?? 0) * 3) / 4);
  // 写真の指紋＋撮影の瞬間で、姿の細部（模様・ポーズ等）に多様性を持たせる seed
  const base = hashString(photo.slice(0, 2048));
  const moment = Math.floor(Date.now() / 1000);
  const seed = (base ^ Math.imul(moment, 2654435761)) >>> 0;

  let result: Awaited<ReturnType<typeof analyzeSpirit>>;
  try {
    console.info("[monomon-pipeline]", {
      stage: "RECOGNITION_STARTED",
      inputMimeType,
      inputImageBytes,
    });
    result = await analyzeSpirit({ data: { photo } });
  } catch (e) {
    const diagnostic: PipelineDiagnostic = {
      failedStage: "RECOGNITION_STARTED",
      reason: e instanceof Error ? e.message : String(e),
      errorType: e instanceof Error ? e.name : typeof e,
      elapsedMs: Math.round(performance.now() - startedAt),
      inputMimeType,
      inputImageBytes,
    };
    console.error("[monomon-pipeline]", diagnostic);
    throw new DiscoveryError("network", "Object recognition request failed", diagnostic);
  }

  if ("error" in result) {
    if (result.error === "rate_limit" || result.error === "credits") {
      throw new DiscoveryError("busy");
    }
    if (result.error === "AIに接続できませんでした") {
      throw new DiscoveryError("network");
    }
    throw new DiscoveryError("unknown");
  }

  console.info("[monomon-pipeline]", {
    stage: "RECOGNITION_SUCCEEDED",
    elapsedMs: Math.round(performance.now() - startedAt),
    object: result.object,
  });

  // 写真がうまく見えないとき：想像で決めず、やさしく撮り直しを促す
  switch (result.quality) {
    case "too_far":
      throw new DiscoveryError("too_far");
    case "too_dark":
      throw new DiscoveryError("too_dark");
    case "blurry":
      throw new DiscoveryError("blurry");
    case "no_object":
      throw new DiscoveryError("unclear");
    default:
      break;
  }
  // 自信が低すぎるときも、当てずっぽうにせず撮り直しへ
  if (result.confidence < MIN_CONFIDENCE) {
    throw new DiscoveryError("unclear");
  }

  // 認識パイプライン：カテゴリ → 家族/種族（明らかに違う家族を防ぐ）
  const species = resolveSpecies(result.category, result.speciesId, result.confident);
  const spec = buildSpec(seed, species.id, result.hue);
  // 見た目はAIの判断に合わせる（ランダム要素を上書き）
  spec.eyes = result.eyes;
  spec.mouth = result.mouth;
  spec.accessory = result.accessory;

  // 合成パス：有効な合成写真が返るまで出会いを成功扱いしない。
  let composedPhoto: string;
  try {
    console.info("[monomon-pipeline]", {
      stage: "COMPOSITION_REQUEST_STARTED",
      inputMimeType,
      inputImageBytes,
    });
    const composed = await composeMonomonScene({
      data: {
        photo,
        spirit: {
          object: result.object,
          speciesName: species.name,
          palette: {
            body: spec.palette.c2,
            accent: spec.palette.c3,
          },
          eyes: result.eyes,
          mouth: result.mouth,
          accessory: result.accessory,
          scale: result.scale,
          placement: result.placement as never,
          anchor: result.anchor as never,
          poseHint: result.poseHint as never,
          placementNote: result.placementNote,

        },
      },
    });
    if (!composed.ok) {
      const diagnostic: PipelineDiagnostic = {
        failedStage:
          composed.reason === "empty_image" || composed.reason === "response_parse"
            ? "GENERATED_IMAGE_PARSED"
            : "COMPOSITION_RESPONSE_RECEIVED",
        status: composed.status,
        model: composed.model,
        reason: composed.reason,
        errorType: composed.errorType,
        elapsedMs: composed.elapsedMs,
        inputMimeType,
        inputImageBytes,
      };
      console.error("[monomon-pipeline]", diagnostic);
      throw new DiscoveryError(
        composed.reason === "timeout" ? "generation_timeout" : "generation_failed",
        composed.reason,
        diagnostic,
      );
    }
    composedPhoto = composed.dataUrl;
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(composedPhoto)) {
      const diagnostic: PipelineDiagnostic = {
        failedStage: "GENERATED_IMAGE_PARSED",
        model: composed.model,
        reason: "Generated image source is not a supported data URL",
        errorType: "invalid_image_source",
        elapsedMs: composed.elapsedMs,
        inputMimeType,
        inputImageBytes,
      };
      console.error("[monomon-pipeline]", diagnostic);
      throw new DiscoveryError("generation_failed", diagnostic.reason, diagnostic);
    }
  } catch (e) {
    if (e instanceof DiscoveryError) throw e;
    const diagnostic: PipelineDiagnostic = {
      failedStage: "COMPOSITION_REQUEST_STARTED",
      reason: e instanceof Error ? e.message : String(e),
      errorType: e instanceof Error ? e.name : typeof e,
      elapsedMs: Math.round(performance.now() - startedAt),
      inputMimeType,
      inputImageBytes,
    };
    console.error("[monomon-pipeline]", diagnostic);
    throw new DiscoveryError("generation_failed", "Composition request failed", diagnostic);
  }

  return {
    ...spec,
    id: makeId(seed),
    name: result.name,
    family: species.family,
    personality: result.personality,
    description: result.description,
    objectLabel: result.object,
    uncertain: !result.confident,
    discoveredAt: new Date().toISOString(),
    photo,
    favorite: false,
    friendship: 0,
    hasComposed: true,
    composedPhoto,
  };
}


/** 装飾用：seed だけから、それっぽい個体 spec を作ります。 */
export function specFromSeed(seed: number, speciesId?: string): MonomonSpec {
  const id =
    speciesId ??
    Object.keys(SPECIES_MAP)[seed % Object.keys(SPECIES_MAP).length];
  return buildSpec(seed >>> 0, id);
}

/** 保存済み/簡易データから、確実に描画用 spec を取り出します（後方互換あり）。 */
export function specOf(
  m: Partial<MonomonSpec> & { seed: number; speciesId?: string },
): MonomonSpec {
  if (m.speciesId && m.palette && m.eyes && m.mouth && m.pattern && m.accessory && m.pose) {
    return {
      speciesId: m.speciesId,
      seed: m.seed,
      palette: m.palette,
      eyes: m.eyes,
      mouth: m.mouth,
      pattern: m.pattern,
      accessory: m.accessory,
      pose: m.pose,
    };
  }
  // 旧バージョンのデータ → 種族を仮決めして再構築
  return buildSpec(m.seed >>> 0, m.speciesId ?? "cup");
}

export function formatDiscoveredDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return "";
  }
}
