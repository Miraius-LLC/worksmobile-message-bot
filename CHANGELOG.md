# Changelog

LINE WORKS Bot Webhook サーバーの整備履歴。**完了の節目で更新**し、コミット単位の詳細は `git log` を参照する（本ファイルは git log と重複しない粒度に保つ）。日付は逆順。

## 受信（Callback）系

- **Callback を 501（scheduler-501）へ転送（案 B）**: 検証を通った callback を raw body + 署名のまま 501 の `/callback` へ素通し転送する gateway 方式に一本化（`callback/forward.ts`、env `FORWARD_501_CALLBACK_URL`、[ADR-0005](./docs/adr/0005-forward-callback-to-501.md)）。応答コマンドの判断は 501 側に置き、本サーバ内のローカル handler 雛形（`callback/{dispatch,handlers,reply}.ts`）は二重応答を避けるため呼ばれない（雛形として残置）。デプロイ env も `cloudbuild.yaml` に明示。
- **Callback dedup（5 分 window）**: LINE WORKS の再送による副作用二重実行を防ぐため、raw body の SHA-256 を key にした in-memory Map で直近 5 分の重複を検出し、ヒットしたら skip して 200 を返す（`callback/dedup.ts`、[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。Cloud Run の min-instances=1 前提。501 転送が throw したら dedup key を `unregister` して再送を許可（転送失敗イベントの喪失防止）。
- **Callback 受信エンドポイント（`POST /callback`）+ event dispatcher**: LINE WORKS からの Bot Callback を受信。`X-WORKS-Signature`（raw body の HMAC-SHA256 を Bot Secret 鍵で計算し Base64 化した値）で真正性を検証し、`discriminatedUnion('type', …)` で event 8 種（`message` / `postback` / `join` / `leave` / `joined` / `left` / `begin` / `end`）を網羅。reply ヘルパ（source → MessageTarget）も追加。

## 送信（Bot API ラッパ）系

- **メッセージ型ディスパッチャ**: メッセージ型を `messageSchemas` マップ（type → Zod schema）に集約し、個別 sender を持たない設計（[ADR-0007](./docs/adr/0007-message-type-dispatcher.md)）。新しいメッセージ型は schema を 1 件足すだけで `routes/messages.ts` のループが `(channels|users)/:id/messages/type/<type>` を自動登録し、`sendMessageByType` が `{ type, …body }` を組み立てて送る。テキスト / 画像 / ファイル / 音声 / 動画 / 位置情報 / リンク / ボタンテンプレート / リストテンプレート / カルーセル / 画像カルーセル / フレキシブルの各型を LINE WORKS spec の制約に揃えて Zod で起動時バリデーション。
- **添付ファイル**: アップロード（uploadUrl 発行 → multipart POST、`bodyLimit` で 10MB 上限）とダウンロード（3xx の `Location` ヘッダ抽出）の両経路を実装（`services/lineworks/attachment.ts`）。
- **server token のキャッシュ + single-flight**: JWT（RS256、`node:crypto` 自前実装、[ADR-0003](./docs/adr/0003-jwt-node-crypto-rs256.md)）からアクセストークンを取得する `getServerToken` をキャッシュ + single-flight 化し、重複取得を抑制。route 層は `tokenMiddleware` 経由で `c.var.token` から受け取る。
- **トークルーム / ドメインメンバー / Bot CRUD**: トークルーム作成・情報取得・退室・メンバー一覧（`/channels`）、Bot 利用ユーザーの登録・一覧・削除（`/domains/:domainId/members`）、固定メニュー / リッチメニュー（`/menus/*`）、テナント Bot とドメイン別 Bot 設定の CRUD（`/bots`）を追加。upstream エラーから code / hint を抽出してレスポンスに含める。

## 認証・観測・運用

- **BASIC 認証（health probe / `/callback` を除く全エンドポイント）**: `hono/basic-auth` を lazy 初期化 + `PUBLIC_PATHS` で除外し、`app.ts` で `app.use('*', …)` 強制（[ADR-0006](./docs/adr/0006-basic-auth-except-health-and-callback.md)）。`/healthz` を正、`/health` / `/readyz` / `/livez` は互換エイリアス。`/callback` は BASIC 認証を喋らないため除外し、署名検証で代替。`app.onError` は `HTTPException` を `getResponse()` で素通り。
- **本番 Bot の自己破壊操作をガード**: 本番運用中の `BOT_ID` に対する `DELETE` / Secret 再発行（`POST /secret`）を、`?confirm=<botId>` クエリ無しでは 403 で拒否。誤操作で本番 Bot を消失させない物理ガード。
- **fetch 共通 timeout wrapper**: 全 service の `fetch` を timeout 付き wrapper に置換し、upstream ハングを防止。
- **request log middleware**: 全リクエストを 1 行で記録するミドルウェアを追加。
- **Cloud Logging 連携**: pino ベース logger に `severity` フィールド + `logging.googleapis.com/trace` を自動付与（`x-cloud-trace-context` を AsyncLocalStorage で保持）。`GOOGLE_CLOUD_PROJECT` 設定時は fully-qualified resource name 形式で trace が出る。

## CI / CD・基盤

- **1Password から `.env` を生成する `secrets:dump` を追加**: `.env.tpl` の `op://` 参照を SoT として読み、値を表示せず `.env` へマージ保存するローカル secret dump を追加。最初の 1 件だけ直列で読み、1Password 未サインイン時の認証要求多重起動を避ける。既存 `secrets:inject` は互換 alias として `secrets:dump` に寄せた。
- **scripts の検証対象化**: pre-commit / CI / package scripts の Biome 対象に `scripts/` を追加し、`run-related-tests.ts` の関連テスト抽出ロジックを unit test 付きで分離。監視設定スクリプトは uptime config の重複取得を削減。
- **Cloud Build に bun test step を追加**: ビルドパイプラインに `bun test` を組み込み、`--no-verify` での pre-push バイパスを防止（[ADR-0008](./docs/adr/0008-docker-cloud-build-constraints.md) / [ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md)）。`cloudbuild.yaml` が Cloud Run 構成（runtime SA / Secret Manager マウント / scaling / resources / ingress）の SoT。
- **HTTP/1.1-only（end-to-end h2c 不採用）**: コンテナは HTTP/1.1 のみで listen し、公開側 HTTP/2 は Cloud Run フロントが終端（`--no-use-http2`、[ADR-0002](./docs/adr/0002-container-http1-only-no-h2c.md)）。
- **Cloud Run + Hono + Bun の採用**: 常時 1 インスタンス張り付きの薄いラッパとして Cloud Run（asia-northeast1）を採用（[ADR-0001](./docs/adr/0001-cloud-run-hono-bun.md)）。専用 runtime SA + Secret Manager + 機密度の低い env は substitution variable で公開リポジトリに値を残さない（[ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md)）。
- **mattpocock engineering skills の per-repo 土台**: 設計決定を `docs/adr/`（9 ADR）に backfill、用語集を root `CONTEXT.md` に新設、`docs/agents/{issue-tracker,domain}.md` + CLAUDE.md `## Agent skills` ブロックを整備。engineering skills を SoT から配布同期。

## スタック

| 層 | 採用 |
|---|---|
| ランタイム / 実行 | Bun 1.3.x / Cloud Run（asia-northeast1） |
| HTTP フレームワーク | Hono + @hono/node-server |
| Validation | Zod + @hono/zod-validator |
| Linter / Formatter | Biome 2.x |
| Logger | pino（+ pino-pretty in dev）、Cloud Logging severity / trace 連携 |
| CI / CD | GitHub Actions（PR で tsc + biome）/ Cloud Build → Cloud Run |
| pre-commit / pre-push | lefthook（biome auto-fix + tsc + 関連テスト / 全件テスト） |
