# 方針：v1.0の挙動に戻し、Design System v3.0の見た目だけを残す

「作り直す」ではなく「巻き戻す」作業として行います。新しい視覚（アイボリー背景・余白・詩的コピー・柔らかいUI）はそのまま残し、それ以外の“動きを不安定にした変更”を最小の範囲で v1.0 の実装に戻します。

## 何を残す（そのまま）

- `src/styles.css` のトークン・アニメーション・タイポグラフィ
- `src/routes/index.tsx` のホーム見た目（ウェルカム／お気に入り表示）
- `src/routes/zukan.tsx` の「思い出の日記」レイアウト
- `src/components/DiscoveryReveal.tsx` の静かなリビール表現
- `GentleError.tsx` の文言と質感
- モノモンのアート（`monomon-art.ts`）と種族データ

## 何を v1.0 の挙動に戻す（機能面のみ）

1. **画像の保存方式**
   - 現状：IndexedDB + localStorage 二重化（`photo-storage.ts` + `useComposedPhoto.ts`）。iOS 実機で不安定・空表示の原因になっていた。
   - 戻し先：v1.0 と同じ「Monomon オブジェクトに `composedPhoto` を data URL のまま持たせて `dexStore`（localStorage 永続）に保存」する単純方式。`saveComposedPhoto` / `getComposedPhotoRef` / `useComposedPhoto` フックを撤去し、`<img src={m.composedPhoto} />` で直接描画。
   - 効果：ナビ・リロード・再起動を跨いで確実に表示。「Memories に写真が出ない」問題の根治。

2. **保存フロー（`dex.ts`）**
   - `verifyImageDecodes` の事前検証・多段ログ・`COMPOSED_IMAGE_REQUIRED` throw を撤去。
   - v1.0 と同じく「与えられた Monomon をそのまま dexStore に unshift」する素直な `addToDex` に戻す。
   - お気に入り／NEW／再会（friendship）ロジックは v1.0 と同じなので維持。

3. **スキャン画面（`scan.tsx`）**
   - カメラ input を永続マウントする v1.0 の実装は維持（iOS ジェスチャー対策として v1.0 でも入っていた分）。
   - 診断（`PipelineDiagnostic`）配線・`onGenerated` の非同期保存待ち・result 差し替えを外し、v1.0 の「生成完了→addToDex→リビール表示」の直線フローに戻す。

4. **生成関数（`monomon-compose.functions.ts`）**
   - モデル・呼び出し形は v1.0 と同じ `google/gemini-3-pro-image` のまま。
   - 診断オブジェクトを返す拡張・120秒タイムアウト・詳細エラーハンドリングを、v1.0 の「成功時は base64、失敗時は throw」に戻す。
   - 直前に強化した「共有DNAプロンプト」の文面自体は残す（見た目の質＝視覚レイヤー扱い）。

5. **Memories（`zukan.tsx`）**
   - 診断用の `onError` ログ配線と `useComposedPhoto` 呼び出しを撤去し、`<img src={m.composedPhoto ?? m.photo}>` の v1.0 描画に戻す。レイアウト／文面はそのまま。

6. **ホーム（`index.tsx`）**
   - `useComposedPhoto` を撤去して同じく直接描画。ウェルカム／お気に入りロジックはそのまま。

## 触らないもの

- `capacitor.config.ts` / `ios/` / `codemagic.yaml`
- Supabase / server function の構造
- ルーティング（TanStack Router の構成）
- 友情度・種族・分類・音・イントロ

## 実装順（1ターンで）

1. `src/lib/dex.ts` を v1.0 相当に戻す（photo-storage 依存を除去）
2. `src/hooks/useComposedPhoto.ts` を削除
3. `src/lib/photo-storage.ts` を削除
4. `src/routes/scan.tsx` から診断配線を除去し onGenerated を同期化
5. `src/components/DiscoveryReveal.tsx` から診断／二重生成防止 useRef を撤去（見た目は据え置き）
6. `src/routes/zukan.tsx` と `src/routes/index.tsx` の画像参照を `m.composedPhoto` 直参照に戻す
7. `src/lib/monomon-compose.functions.ts` の戻り値を v1.0 のシンプル形に戻す（プロンプト文言は維持）
8. `src/components/GentleError.tsx` から `diagnostic` prop を除去（文言・スタイルは維持）
9. tsgo で通ることを確認

## リスクと確認

- 「localStorage 5MB 上限」を理由に IDB を導入していた経緯があるため、v1.0 の直保存でも大量に貯めるとやがて満杯になる可能性は残る（=元々の v1.0 の性質）。今回はそこは触らず、まず「確実に出る」ことを優先。将来的な圧縮／リサイズは別タスク扱い。
- 生成失敗時の UX は v1.0 の「もう一度撮る」に戻る（詳細診断表示は開発モード含め廃止）。

進めてよろしければ実装します。
