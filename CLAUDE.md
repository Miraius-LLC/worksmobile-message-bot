# worksmobile-message-bot — Claude Code 向けプロジェクト指示

LINE WORKS Bot の Webhook サーバー。Bun + TypeScript + Hono。IFTTT / Make から Webhook 経由でメッセージ送信・添付ファイルアップロード/ダウンロードを行うための薄いラッパ。エンドポイント仕様は **`@README.md`** に詳細。本ファイルはコードから読み取りづらい規約・ゴッチャに限定する。

## ルール (常時適用)

@./.claude/rules/coding-conventions.md
@./.claude/rules/commit.md
@./.claude/rules/worktree.md
@./.claude/rules/git-log.md
@./.claude/rules/tests.md

## Agent skills

mattpocock/skills（develop-meta で導入済）の engineering skill 用 per-repo 設定。

### Issue tracker

専用 tracker は未使用（`TODO.md` も無い）。機能の SoT は [`README.md`](./README.md)（エンドポイント仕様）、履歴は git commits。`to-issues` / `triage` / `to-prd` は非アクティブ。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

### Domain docs

single-context。用語集 = root [`CONTEXT.md`](./CONTEXT.md)、設計決定 = [`docs/adr/`](./docs/adr/)、補助 = 本 CLAUDE.md（運用ゴッチャ）/ [`README.md`](./README.md)（エンドポイント仕様）/ [`.claude/rules/`](./.claude/rules/)（routes / services / tests-lineworks）。詳細は [`docs/agents/domain.md`](./docs/agents/domain.md)。

### TDD

新機能・bugfix は `tdd` skill の red-green vertical（1 テスト → 1 実装、「書いてからテスト」にしない）で進める。`tdd` skill = workflow の SoT、[`.claude/rules/tests.md`](./.claude/rules/tests.md) = 配置 / mock の mechanics（補完関係、競合しない）。

## トピック別ルール (作業に応じて読む)

- ルート (HTTP エンドポイント) を追加・修正する → `.claude/rules/routes.md`
- service 層 (LINE WORKS API ラッパ) を触る → `.claude/rules/services.md`
- LINE WORKS 関連のテストパターン (典型モック / app.request / multipart) → `.claude/rules/tests-lineworks.md`

## 主要コマンド

| 用途 | コマンド |
|---|---|
| 開発サーバ起動 (ホットリロード, .env 自動読込) | `bun run dev` |
| 型チェック | `bunx tsc --noEmit` |
| Lint/format (auto-fix) | `bunx biome check --write ./src` |
| 本番ビルド | `bun run build` |
| Docker イメージビルド | `bun run docker:build` |

`pre-commit` で biome auto-fix と `tsc --noEmit` が走る。手動で先回り実行する必要は無い。

## アーキテクチャ (要点のみ)

- `src/index.ts` — エントリ。`Hono` インスタンス生成 → trace / secure-headers ミドルウェア → サブルータを `app.route(...)` で mount → `@hono/node-server` の `serve()` で起動 + SIGTERM の graceful shutdown
- `src/routes/_middleware.ts` — `tokenMiddleware` で `c.var.token` に LINE WORKS のアクセストークンを注入
- `src/routes/messages.ts` — `messagesApp` (Hono) を export。`(channels|users)/:id/messages/type/<type>` を 20 エンドポイント分まとめて `app.post(...)` で登録 (zValidator + `sendMessageByType`)
- `src/routes/attachments/` — `attachmentsApp` (Hono) を export。`/attachments` prefix 配下に `POST /` (upload + 10MB bodyLimit) と `GET /:fileId` (download) をマウント
- `src/services/lineworks/` — LINE WORKS API ラッパ
  - `auth.ts` — JWT 生成 (`node:crypto` で RS256 自前実装) + アクセストークン取得 + キャッシュ + single-flight (`getServerToken`)
  - `api.ts` — Bot API への JSON POST 共通処理 (`postJson`, `sendBotMessage`)
  - `messages/index.ts` — 10 type 分の Zod schema + `sendMessageByType` 汎用 dispatcher (`{ type, ...body }` で組み立てて送信)
  - `attachment.ts` — アップロード / ダウンロード URL 解決
- `src/utils/config.ts` — Zod schema で env を起動時に検証 + `.transform()` で camelCase Config に整形 (fail-fast)
- `src/utils/logger.ts` — pino ベース logger。Cloud Logging の `severity` フィールド + `logging.googleapis.com/trace` を自動付与
- `src/utils/trace.ts` — `x-cloud-trace-context` ヘッダを AsyncLocalStorage で保持して logger に流す Hono ミドルウェア
- `src/utils/zod-locale.ts` — Zod のエラーメッセージ日本語化マップ
- `src/types/lineworks.ts` — `MessageTarget` の共有型 (それ以外は z.infer で導出)

## 環境変数

| 変数 | 取り扱い |
|---|---|
| `CLIENT_ID` | env (機密度低) |
| `CLIENT_SECRET` | **Secret Manager `lineworks-client-secret:latest`** にマウント (本番) / `.env` (開発) |
| `SERVICE_ACCOUNT` | env (機密度低) |
| `PRIVATE_KEY` | **Secret Manager `lineworks-private-key:latest`** にマウント (本番) / `.env` (開発)。Base64 エンコード済 PEM (`base64 -i private_*.key`) |
| `BOT_ID` | env (機密度低) |
| `BOT_SECRET` | **Secret Manager `lineworks-bot-secret:latest`** にマウント (本番) / `.env` (開発)。Callback の `X-WORKS-Signature` (HMAC-SHA256) 検証鍵。Developer Console の Bot 詳細から取得した値をそのまま入れる (Base64 デコード等は不要) |
| `BASIC_ID` | **Secret Manager `lineworks-basic-id:latest`** にマウント (本番) / `.env` (開発)。webhook 公開エンドポイント保護用の BASIC 認証ユーザ名 |
| `BASIC_PASS` | **Secret Manager `lineworks-basic-pass:latest`** にマウント (本番) / `.env` (開発)。BASIC 認証パスワード |
| `PORT` | リッスンポート (デフォルト 8080) |
| `NODE_ENV` | `production` でログレベルを `warn` 以上に絞る (`logger-impl.ts`、4xx は warn で残し Error Reporting には乗せない)。`shouldUsePretty` が production では `LOG_PRETTY=1` を無視して JSON 出力に倒す |
| `LOG_PRETTY` | `1` で pino-pretty 経由のカラー出力 (development のみ有効) |
| `GOOGLE_CLOUD_PROJECT` | Cloud Run 上で設定すると Cloud Logging の trace 連携が fully-qualified resource name (`projects/<id>/traces/<traceId>`) で出る。未設定なら trace ID 単独 |

## 注意点 (コードから読めない / 読みづらいもの)

### MUST (これを破ると壊れる)

- **JWT は `node:crypto` で自前生成 + `aud` 固定** ([ADR-0003](./docs/adr/0003-jwt-node-crypto-rs256.md))。`auth.ts` 内の `AUTH_URL` 定数 (`https://auth.worksmobile.com/oauth2/v2.0/token`) を `aud` と一致させる。仕様変更時は base64url エンコードと改行に注意
- **`PRIVATE_KEY` は Base64 エンコード**を前提に PEM へデコードしている。生 PEM をそのまま入れると JWT 署名で失敗。`config.ts` の Zod schema が起動時に PEM 含有チェックする
- **添付ファイル取得は 3xx の Location 抽出**。LINE WORKS のダウンロード API は 3xx を返してくるため `redirect: 'manual'` で受け、`Location` ヘッダから実 URL を取り出す。`fetch` のデフォルト (follow) ではリダイレクト先に Authorization ヘッダが付与されない問題と二重に絡むので変えない
- **アクセストークンの scope は `bot` 固定**。他スコープが必要になる場合は `auth.ts` を分岐させる前に LINE WORKS 側の権限設定を確認
- **`getServerToken` はキャッシュ + single-flight 済み**。直接 `fetch` を叩き直す変更は避け、`auth.ts` の `cached` / `inFlight` の状態管理を尊重する

### よくあるハマり

- **コンテナは HTTP/1.1 のみで listen / end-to-end h2c は採用しない** ([ADR-0002](./docs/adr/0002-container-http1-only-no-h2c.md))。公開側 HTTP/2 は Cloud Run フロントが終端、コンテナは HTTP/1.1。`gcloud run deploy` に `--use-http2` は**つけない**
- **multipart は `c.req.parseBody()` で File を受ける**: Hono は Web 標準 (`File` / `FormData`) を使う。multer / @fastify/multipart 系の API には戻さない。アップロードサイズは `attachments/index.ts` の `bodyLimit({ maxSize: 10 * 1024 * 1024 })` で 10MB 上限
- **route handler は try/catch しない**: throw されたエラーは `index.ts` の `app.onError` が拾って `{ error: message }` を 500 で返す。各ハンドラから 500 を直接返す書き方はしない (validation 400 など期待エラーを除く)
- **token は middleware 経由**: `routes/_middleware.ts` の `tokenMiddleware` が `c.var.token` に注入する。各ハンドラで `await getServerToken()` を呼ばない
- **BASIC 認証は `app.ts` で `/` と health probe / `/callback` 以外に強制** ([ADR-0006](./docs/adr/0006-basic-auth-except-health-and-callback.md))。`hono/basic-auth` を lazy 初期化 + `PUBLIC_PATHS` で除外。`/healthz` を正、`/health` / `/readyz` / `/livez` は互換エイリアスで同じハンドラを共有 (`HEALTH_PATHS` 配列で集中管理)
- **`app.onError` は `HTTPException` を `getResponse()` で素通り**: `basicAuth` 等 Hono ミドルウェアが投げる HTTPException を 500 で潰さないため (LineWorksApiError 透過と同じパターンで明示分岐)
- **callback dedup は in-memory Map で 5 分 window** ([ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md))。`callback/dedup.ts` が raw body の SHA-256 を key に再送を検出。**min-instances=1** 前提。501 転送 (`forward.ts`) が throw したら `unregister` で再送許可 (喪失防止)
- **callback は 501 に転送する (案 B)** ([ADR-0005](./docs/adr/0005-forward-callback-to-501.md))。`callback/forward.ts` が env `FORWARD_501_CALLBACK_URL` へ raw body + `X-WORKS-Signature` を素通し。応答コマンドの handler は 501 側にあり、wmbot 内の `dispatch.ts` / `handlers/` は現在呼ばれない (雛形として残置)

### Docker / デプロイ

> Docker / Cloud Build の構造的な決定は [ADR-0008](./docs/adr/0008-docker-cloud-build-constraints.md) (マルチステージ / BuildKit 不可 / 非 root / curl レス healthcheck / cloudbuild.yaml が SoT)、SA / secret 運用は [ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md) (専用 runtime SA / Secret Manager / 公開リポ向け substitution) を参照。以下は実装の細部ゴッチャ。

- **runtime ベースは `oven/bun:<ver>-slim`** (debian-slim)。builder は `oven/bun:<ver>-debian` (フル) を使い分ける
- **CMD は `["bun", "build/index.js"]`** で直接バンドルを起動 (`bun run start` → package.json 参照を避ける)
- **`bun` のバージョンは Dockerfile 冒頭の `FROM` 2 行で固定**。`.tool-versions` と一致させる (片方だけ上げないこと)
- **`.env` は build context に入れない**: `.dockerignore` で除外済。Cloud Run へは `--set-env-vars` / `--set-secrets` で注入
- **機密 env を Cloud Run の env に直書きしない** ([ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md))。`gcloud secrets versions add` で値を更新すると Cloud Run は `:latest` を参照するため再 deploy 不要で差し替えできる。機密度の低い env も substitution variable 経由で yaml には値を残さない
- **Artifact Registry の cleanup policy 設定済**: タグ無しイメージは 7 日後削除、タグ付きは最新 10 件保持 (`cloud-run-source-deploy` リポジトリ)

### 命名・配置の慣習

- **送信先は `channelId` か `userId` の片方のみ**: `messages/index.ts` の `buildMessageUrl` がどちらか一方を要求する
- **メッセージタイプは `messageSchemas` マップに集約 + 個別 sender なし** ([ADR-0007](./docs/adr/0007-message-type-dispatcher.md))。新タイプは `services/lineworks/messages/index.ts` に schema を 1 件足すだけで `routes/messages.ts` のループが `(channels|users)/:id/messages/type/<type>` を自動登録、`sendMessageByType` が `{ type, ...body }` を組み立てて送る
- **`_` で始まるファイルは内部ヘルパ**: `routes/_middleware.ts` のように、サブルータに直接マウントしない補助モジュールであることを示す慣習 (501 ルール継承)
