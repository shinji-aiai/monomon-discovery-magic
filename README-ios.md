# モノモン — iOS (Capacitor) ビルド手順

このプロジェクトを **Capacitor** で iOS アプリ化し、App Store へ提出するための手順です。
アプリの動作は Web 版とまったく同じです（ネイティブの WKWebView が公開中の
Monomon をそのまま表示します）。

## アーキテクチャについて（重要）

Monomon は TanStack Start の **SSR アプリ**で、AI 認識・応援決済などは
サーバー関数で動いています。SSR アプリは静的ファイルだけでは動かせないため、
ネイティブアプリは `capacitor.config.ts` の `server.url` から
**公開中の Web アプリを読み込む**構成にしています。

- 公開 URL: `https://monomon-discovery-magic.lovable.app`
- URL を変更した場合は `capacitor.config.ts` の `server.url` を更新してください。
- カメラは Web の `<input type="file" capture>` を使うため、WKWebView 上でも
  ネイティブのカメラが起動します（下記の権限説明が必須）。

## Codemagic で IPA を自動ビルド（Xcode 手作業なし）

`ios/` フォルダと `codemagic.yaml` はリポジトリにコミット済みなので、
Codemagic はクローンするだけで署名付き IPA をビルドできます。iOS プロジェクトは
**Swift Package Manager** 方式のため CocoaPods は不要です。

Codemagic 側の初回設定（UI 上での一度きり・Xcode 不要）:

1. Codemagic に GitHub リポジトリを接続する。
2. **Teams / App settings → Integrations** で
   **App Store Connect API key** を追加し、名前を必ず
   `codemagic_asc_api_key` にする（証明書・プロビジョニングプロファイルの
   自動生成とアップロードに使われ、Xcode での手動署名を完全に置き換えます）。
3. App Store Connect で bundle id `com.shinjikumagai.monomon` のアプリを登録する。

あとは Codemagic で `ios-appstore` ワークフローを実行すると、以下が自動で走ります:

- `npm install`
- `npx cap sync ios`（生成ファイルを復元）
- 自動コード署名（`xcode-project use-profiles`）
- ビルド番号の自動採番
- 署名付き IPA のビルド（成果物 `build/ios/ipa/*.ipa`）

TestFlight へ自動配信したい場合は `codemagic.yaml` の
`submit_to_testflight: true` に変更してください。

## 前提（ローカル macOS でビルドする場合）

Codemagic を使わずローカルでビルドする場合のみ、以下が必要です。



iOS のビルドは **Mac + Xcode** が必須です（Windows/Linux/このエディタ上では不可）。

- macOS
- [Xcode](https://apps.apple.com/app/xcode/id497799835)（App Store から）
- Apple Developer Program への登録（App Store 提出用）
- Node.js + Bun（このリポジトリと同じ環境）

※ この iOS プロジェクトは **Swift Package Manager** 方式なので CocoaPods は不要です。

## セットアップ（初回のみ）

`ios/` フォルダはリポジトリにコミット済みです。生成ファイルを最新化するには:

```bash
bun install
bun run ios:sync      # = npx cap sync ios（設定・Webアセット・プラグインを同期）
```

## Xcode で開いて実行（任意）

```bash
bun run ios:open      # = npx cap open ios
```

Xcode で:

1. 左上のターゲット `App` を選択 → **Signing & Capabilities**
2. **Team** に自分の Apple Developer アカウントを設定
3. **Bundle Identifier** は `com.shinjikumagai.monomon`（必要なら自分のものに変更）
4. 実機またはシミュレータを選んで ▶︎ で起動

## 権限の説明文（Info.plist）— 設定済み

カメラ・写真の権限説明は `ios/App/App/Info.plist` に設定済みです（下記）。
変更したい場合はこのファイルを直接編集してください。

```xml
<key>NSCameraUsageDescription</key>
<string>モノに宿る精霊「モノモン」を見つけるために、写真の撮影に使います。</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>アルバムの写真からモノモンを見つけるために使います。</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>見つけたモノモンのカードを写真に保存するために使います。</string>
```

## アイコンとスプラッシュ

- アプリアイコン: Xcode の `Assets.xcassets` → `AppIcon` に 1024×1024 の
  画像を設定してください。
- スプラッシュ背景色はクリーム（`#fbf3e6`）に設定済みです
  （`capacitor.config.ts` の `SplashScreen`）。

## App Store 提出

1. Xcode メニュー **Product → Archive**
2. **Distribute App → App Store Connect** でアップロード
3. [App Store Connect](https://appstoreconnect.apple.com) でアプリ情報・
   スクリーンショット・プライバシー情報を入力して審査に提出

### 審査で注意する点

- Web ラッパーとみなされないよう、ネイティブならではの価値（カメラでの発見体験、
  オフライン時のやさしい案内など）をスクリーンショットと説明で伝えてください。
- 権限説明文（上記 Info.plist）を必ず設定してください。
- 決済（応援）は外部の Stripe Checkout を使うため、デジタルコンテンツの
  アプリ内課金には該当しません（物理/寄付系）。内容に応じて審査ガイドラインを
  確認してください。

## Web 版の更新をアプリへ反映

`server.url` 方式なので、**Web を再公開するだけでアプリの中身も更新**されます。
再申請は、ネイティブ側（アイコン・権限・Capacitor 設定など）を変えたときだけ必要です。

## 設定を変えたら同期

`capacitor.config.ts` やプラグインを変更したら、必ず同期してください。

```bash
bun run ios:sync
```
