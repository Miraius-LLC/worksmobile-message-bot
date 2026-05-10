# worksmobile-message-bot — Claude Code 向けプロジェクト指示

LINE WORKS Bot の Webhook サーバー。Bun + TypeScript + Hono。IFTTT / Make から Webhook 経由でメッセージ送信・添付ファイルアップロード/ダウンロードを行うための薄いラッパ。エンドポイント仕様は **`@README.md`** に詳細。本ファイルはコードから読み取りづらい規約・ゴッチャに限定する。

## ルール (常時適用)

@./.claude/rules/commit.md
@./.claude/rules/worktree.md

## トピック別ルール (作業に応じて読む)

- ルート (HTTP エンドポイント) を追加・修正する → `.claude/rules/routes.md`
- service 層 (LINE WORKS API ラッパ) を触る → `.claude/rules/services.md`
- テストを書く・直す → `.claude/rules/tests.md`

## コードスタイル (デフォルト差分)

- import パスは `@/` で `src/` を参照 (拡張子 `.ts` は付けない)
- Linter/Formatter は **Biome** 単体。スタイル整形は手で書き直さず Biome に任せる
- ログは `@/utils/logger` 統合。各ファイル冒頭で `const CALLER = '...'` を宣言し、メソッド毎に `${CALLER}.<method>` を logger オプションに渡す

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
| `BASIC_ID` | **Secret Manager `lineworks-basic-id:latest`** にマウント (本番) / `.env` (開発)。webhook 公開エンドポイント保護用の BASIC 認証ユーザ名 |
| `BASIC_PASS` | **Secret Manager `lineworks-basic-pass:latest`** にマウント (本番) / `.env` (開発)。BASIC 認証パスワード |
| `PORT` | リッスンポート (デフォルト 8080) |
| `NODE_ENV` | `production` で JSON ログを抑制せずそのまま出す (Hono 自体は logger を内蔵しないので env による分岐は最小限) |
| `LOG_PRETTY` | `1` で pino-pretty 経由のカラー出力 (development のみ有効) |
| `GOOGLE_CLOUD_PROJECT` | Cloud Run 上で設定すると Cloud Logging の trace 連携が fully-qualified resource name (`projects/<id>/traces/<traceId>`) で出る。未設定なら trace ID 単独 |

## 注意点 (コードから読めない / 読みづらいもの)

### MUST (これを破ると壊れる)

- **JWT の `aud` は固定**: `https://auth.worksmobile.com/oauth2/v2.0/token`。LINE WORKS の OAuth エンドポイント自体を `aud` にする仕様で、`auth.ts` 内の `AUTH_URL` 定数と一致させる
- **JWT は `node:crypto` で自前生成** (`createSign('RSA-SHA256')`)。`jsonwebtoken` パッケージは撤去済。仕様変更時は base64url エンコードと改行に注意
- **`PRIVATE_KEY` は Base64 エンコード**を前提に PEM へデコードしている。生 PEM をそのまま入れると JWT 署名で失敗。`config.ts` の Zod schema が起動時に PEM 含有チェックする
- **添付ファイル取得は 3xx の Location 抽出**。LINE WORKS のダウンロード API は 3xx を返してくるため `redirect: 'manual'` で受け、`Location` ヘッダから実 URL を取り出す。`fetch` のデフォルト (follow) ではリダイレクト先に Authorization ヘッダが付与されない問題と二重に絡むので変えない
- **アクセストークンの scope は `bot` 固定**。他スコープが必要になる場合は `auth.ts` を分岐させる前に LINE WORKS 側の権限設定を確認
- **`getServerToken` はキャッシュ + single-flight 済み**。直接 `fetch` を叩き直す変更は避け、`auth.ts` の `cached` / `inFlight` の状態管理を尊重する

### よくあるハマり

- **コンテナは HTTP/1.1 のみで listen**: end-to-end h2c は **採用しない**。理由は Bun / Node の `node:http2` 単独サーバが HTTP/1.1 を併行受信できず (`allowHTTP1` は ALPN/Upgrade 経由のみ機能)、Cloud Run の Envoy は素の HTTP/1.1 を投げてくるため protocol error になる
- **公開側の HTTP/2 は Cloud Run フロントエンドが終端する**: クライアント↔Cloud Run は HTTP/2、Cloud Run↔コンテナは HTTP/1.1。`gcloud run deploy` に `--use-http2` フラグは**つけない**。webhook サーバなので multiplexing の効果は限定的
- **multipart は `c.req.parseBody()` で File を受ける**: Hono は Web 標準 (`File` / `FormData`) を使う。multer / @fastify/multipart 系の API には戻さない。アップロードサイズは `attachments/index.ts` の `bodyLimit({ maxSize: 10 * 1024 * 1024 })` で 10MB 上限
- **route handler は try/catch しない**: throw されたエラーは `index.ts` の `app.onError` が拾って `{ error: message }` を 500 で返す。各ハンドラから 500 を直接返す書き方はしない (validation 400 など期待エラーを除く)
- **token は middleware 経由**: `routes/_middleware.ts` の `tokenMiddleware` が `c.var.token` に注入する。各ハンドラで `await getServerToken()` を呼ばない
- **BASIC 認証は `app.ts` で `/` と `/health` 以外に強制**: `hono/basic-auth` を lazy 初期化 (config().load() タイミングを跨ぐため) + `PUBLIC_PATHS` set で除外パスを管理。Cloud Run health probe / Docker HEALTHCHECK が落ちないよう `/` `/health` だけ素通しにしている
- **`app.onError` は `HTTPException` を `getResponse()` で素通り**: `basicAuth` 等 Hono ミドルウェアが投げる HTTPException を 500 で潰さないため (LineWorksApiError 透過と同じパターンで明示分岐)

### Docker / デプロイ

- **マルチステージビルド**: builder で `bun install` + `bun run build` → runtime には `build/index.js` だけ COPY する。`node_modules` / `tsconfig.json` / `package.json` は runtime に**残さない**
- **runtime ベースは `oven/bun:<ver>-slim`** (debian-slim)。builder は `oven/bun:<ver>-debian` (フル) を使い分ける
- **非 root で起動**: `USER bun` (uid 1000)。COPY は `--chown=bun:bun` を付ける
- **BuildKit 限定構文は使わない**: Cloud Build のデフォルト `gcr.io/cloud-builders/docker` が BuildKit 非対応。`--mount=type=cache` / `--mount=type=secret` 等は禁止。普通のレイヤキャッシュ (`COPY package.json bun.lock` を独立ステップにする等) で代替する
- **HEALTHCHECK は `curl` を入れず `bun -e "fetch(...)"`** で `/health` を叩く。curl パッケージを入れない方針
- **CMD は `["bun", "build/index.js"]`** で直接バンドルを起動 (`bun run start` → package.json 参照を避ける)
- **`bun` のバージョンは Dockerfile 冒頭の `FROM` 2 行で固定**。`.tool-versions` と一致させる (片方だけ上げないこと)
- **`.env` は build context に入れない**: `.dockerignore` で除外済。Cloud Run へは `--set-env-vars` / `--set-secrets` で注入
- **build / deploy パイプラインは `cloudbuild.yaml` に記述**: trigger に inline build を残さず、ファイル経由で動かす (filename 設定が必要)。Cloud Run 固有設定 (SA / secrets / scaling / resources / `--no-use-http2` / labels) はすべてここで管理し、手動 `gcloud run services update` での drift を防ぐ
- **Cloud Run の runtime SA は専用**: `worksmobile-message-bot-sa@office-381404.iam.gserviceaccount.com`。デフォルトの compute SA は使わない (権限分離)。SA は `lineworks-client-secret` / `lineworks-private-key` / `lineworks-basic-id` / `lineworks-basic-pass` の `secretAccessor` ロールのみ持つ
- **機密 env は Secret Manager 経由**: `CLIENT_SECRET` / `PRIVATE_KEY` / `BASIC_ID` / `BASIC_PASS` を Cloud Run の env に**直書きしない**。`gcloud secrets versions add` で値を更新し、Cloud Run は `:latest` を参照する設定 (`--update-secrets=...`) のため、再 deploy 不要で値だけ差し替え可能
- **機密度の低い env (`CLIENT_ID` / `SERVICE_ACCOUNT` / `BOT_ID`) も毎回再アサート**する drift 防止策。ただしリポが**公開**なので **値自体は cloudbuild.yaml に書かない**。GCP Console 側の Cloud Build トリガー設定で `_CLIENT_ID` / `_SERVICE_ACCOUNT_LW` / `_BOT_ID` の substitution variable に値を入れる。yaml 側はプレースホルダ参照 (`${_CLIENT_ID}` 等) のみ
- **Artifact Registry の cleanup policy 設定済**: タグ無しイメージは 7 日後削除、タグ付きは最新 10 件保持 (`cloud-run-source-deploy` リポジトリ)

### 命名・配置の慣習

- **送信先は `channelId` か `userId` の片方のみ**: `messages/index.ts` の `buildMessageUrl` がどちらか一方を要求する
- **メッセージタイプは `services/lineworks/messages/index.ts` の `messageSchemas` マップに集約**。新タイプを足す時はそこに schema を 1 件追加するだけで、`routes/messages.ts` のループが自動で `(channels|users)/:id/messages/type/<type>` を登録 + 汎用 `sendMessageByType` が `{ type, ...body }` を組み立てて送信する。**個別 sender 関数は書かない**
- **`_` で始まるファイルは内部ヘルパ**: `routes/_middleware.ts` のように、サブルータに直接マウントしない補助モジュールであることを示す慣習 (501 ルール継承)
