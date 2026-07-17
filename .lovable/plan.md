
# モノモン自然合成 — 本番実装アーキテクチャ

## 目的
撮影した実物写真の中に、極小のモノモンが「最初からそこに住んでいた」ように溶け込む1枚を生成する。ステッカー・オーバーレイ・浮遊マスコットは絶対に作らない。

## 判断基準
「初めて見た人が『この写真の中に本当にいた』と信じるか？」

---

## 全体アーキテクチャ

```text
[scan.tsx] 撮影 → 720px dataURL
    │
    ▼
[DiscoveryReveal] 「光が集まる…」の演出中に並列で↓
    │
    ├── analyzeSpirit (既存)  ← 種族/名前/性格/hue/eyes/mouth/描画パラメタ
    │        └─ AIビジョン (google/gemini-3.5-flash) 認識のみ
    │
    └── composeMonomonScene (新規) ← 元写真＋モノモンspecを渡し、
             合成済み写真(image/png dataURL)を返す
             └─ google/gemini-3-pro-image (image editing)
                 ・入力: 元写真 + 「配置戦略」テキスト
                 ・出力: 元画像とほぼ同一・微小な合成のみ許可
    │
    ▼
[Monomon] .composedPhoto を新規フィールドで保持（元 .photo は不変）
    │
    ▼
[dex に保存] IndexedDB Blob として合成PNGを別テーブルへ
    │
    ▼
[結果画面 / 思い出] composedPhoto があれば表示、なければ photo にフォールバック
```

キーポイント：**元写真は絶対に上書きしない**。合成結果は追加フィールド。失敗時は元写真だけで完結して壊れない。

---

## モデル選定

| 用途 | モデル | 理由 |
|---|---|---|
| 認識（既存） | `google/gemini-3.5-flash` | 高速・多言語・JSON安定 |
| **合成（新規）** | **`google/gemini-3-pro-image`** | Lovable AI Gateway 上で編集品質最高。元画像の光/影/被写界深度の再現力が現行最強。ストリーミング partial_image 対応で発見演出と親和 |

`google/gemini-3.1-flash-image` は速度用フォールバックとして保持（コスト超過・レート時のみ）。GPT-Image-2 はキャラ合成でモデレーション拒否が多いため使わない。

---

## 合成プロンプト設計（品質のかなめ）

構造化した「配置戦略」を LLM に別途生成させ、合成モデルに手渡す2段構え。

1. **配置戦略の決定**（認識と同じ呼び出しに追加フィールド）
   - `placement`: `inside | peek_edge | behind | between | under_rim | in_fold | on_handle` 等（物体カテゴリから語彙選択）
   - `scale`: 0.05〜0.20（元画像の短辺に対する割合、非常に小さく）
   - `anchor`: `top-left | ... | center-right` 等、9マス位置
   - `pose_hint`: `peeking | curled_sleeping | hanging | tucked` 等

2. **合成プロンプト（英語で厳密に指示）**
   ```
   Edit this photograph. Insert a tiny creature described as:
   "{species silhouette}, size ~{scale*100}% of image short edge,
    matte {palette.body} body with soft {palette.accent} accents,
    {eyes} eyes, {mouth} mouth, {accessory}".
   Placement: {placement} of the main object, anchored {anchor}.
   Pose: {pose_hint}.
   MUST match the photograph's existing:
   - light source direction and color temperature
   - shadow softness and direction (cast a matching contact shadow)
   - depth of field and lens blur at that depth
   - film grain and noise pattern
   - perspective and vanishing lines
   The creature must appear physically present in the scene,
   as if photographed together. Do NOT alter anything else in the image.
   Do NOT add stickers, outlines, glow, sparkles, or cartoon effects.
   Output the entire original photograph unchanged except for the
   inserted creature and its own contact shadow.
   ```

「モノモン自体のビジュアルアイデンティティ」は、種族×パレット×表情の言語化で担保。手続き型SVG(`monomon-art.ts`)はカード/図鑑アイコン用に残し、写真合成は「言葉で記述された同じ個体」を毎回描画する（生成AIは同一性を厳密には保てないので、後述の一貫性戦略で補う）。

---

## 一貫性戦略（同じ個体を「同じ子」に保つ）

生成AIは種族・色・表情が言語一致していれば「同じ子っぽさ」は出るが、ピクセル一致は不可能。これを設計で受け止める：

- **合成写真は「発見の瞬間」の記録**として1回生成し、Blobで固定保存 → 以後は再生成しない
- 図鑑・思い出の一覧は、常にその**固定された1枚**を表示 → 同じ子を見る限り常に同じ姿
- 手続きSVGは「アイコン用の記号」として補助的に残す（カード裏面、共有画像など）

これにより「毎回顔が違う」問題を設計で回避。

---

## ストレージ戦略

合成PNG(概ね 200–500KB)を localStorage に入れると即座に枯れる。専用ストア：

- `src/lib/photo-storage.ts` (新規)
  - IndexedDB（`idb-keyval` 使用、既存依存に無ければ追加）
  - キー: `monomon.id`、値: `{ composed: Blob, original: Blob }`
  - 読み出しは `URL.createObjectURL` でメモリ内 blob URL 化
  - `removeFromDex` 時に対応 blob を削除
  - `clearDex` で全削除
- `Monomon` 型からは大きな dataURL を外し、`hasComposed: boolean` フラグのみ保持
- 既存の `photo: string`（dataURL）は後方互換のため残し、新規発見からは IndexedDB 側に格納する移行方針

これでストレージ枯渇と localStorage 5MB制限を根本回避。

---

## キャッシュ / 冪等性

- 発見1回 = 合成1回。**同じ個体で再生成しない**（コストと一貫性の両立）
- スキャン中に前後で「同じ写真ハッシュ」なら既存 Monomon を返す（既に `dex.ts` で実装済）
- 合成失敗時は Monomon を保存しつつ `hasComposed=false` で運用継続。詳細画面に「もう一度この子を写真に描き直す」導線（明示的再試行のみ）を将来追加できる余地

---

## コスト管理

- 合成は「思い出に残す」タイミングではなく「発見時1回のみ」
- 失敗はカウントしない（ユーザーには元写真で成立）
- 将来のレート制限UI（1日N回）に備え、`composeMonomonScene` に軽い呼び出しカウンタ（localStorage 日次）を仕込むフックだけ用意（デフォルト無効）

---

## エラーハンドリング（絶対に体験を壊さない）

| ケース | 挙動 |
|---|---|
| 合成モデルが429/402 | 元写真のみで発見成立、`hasComposed=false` |
| モデレーション拒否 | 同上 |
| タイムアウト(20s) | 同上 |
| 出力サイズ異常 | 破棄、元写真で成立 |

**発見演出は元写真だけでも完成する**設計。合成は「叶えば嬉しい」ボーナス層。

---

## ファイル変更

### 新規
- `src/lib/monomon-compose.functions.ts` — `composeMonomonScene` サーバー関数
- `src/lib/photo-storage.ts` — IndexedDB による合成写真ストア
- `src/hooks/useComposedPhoto.ts` — Monomon から blob URL を購読

### 変更
- `src/lib/monomon-ai.functions.ts` — SpiritAnalysis に `placement/scale/anchor/pose_hint` を追加
- `src/lib/monomon.ts` — `generateMonomon` から合成呼び出し、`Monomon` に `hasComposed` 追加
- `src/lib/dex.ts` — 削除時に blob も破棄
- `src/components/DiscoveryReveal.tsx` — 合成が返るまでもう少し待つ（既存の GATHER 段階を伸ばす）＋合成写真があればそちらを最終フレームに使用
- `src/routes/scan.tsx` (result) — composedPhoto 優先表示
- `src/routes/zukan.tsx` — 思い出ページで composedPhoto 優先表示、なければ元写真

### 触らない
- `monomon-art.ts` / SVG系（補助用途で残置）
- Design System v3.0 の全画面レイアウト・トーン

---

## 依存追加
- `idb-keyval` (数KB、IndexedDB 薄ラッパ)

---

## 完了判定チェックリスト
1. ✅ 元写真は保存済みで、上書きされない
2. ✅ 合成失敗しても発見体験が完結する
3. ✅ 同じ個体を後から見ても顔が変わらない（Blob固定）
4. ✅ 合成写真に「ステッカー枠・光・キラキラ」等のオーバーレイ効果が付いていない（プロンプトで明示除外）
5. ✅ モノモンは元画像の光源方向・DoF・粒子と整合
6. ✅ localStorage を汚さない（合成PNGはIndexedDB）
7. ✅ 全画面が Design System v3.0 のトーンを維持

問題なければこの通り実装します。修正指示があれば教えてください。
