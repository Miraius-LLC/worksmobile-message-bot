# worksmobile-message-bot — Claude Code 向けプロジェクト指示

LINE WORKS Bot の Webhook サーバー。Bun + TypeScript + Hono。IFTTT / Make から Webhook 経由でメッセージ送信・添付ファイルアップロード/ダウンロードを行うための薄いラッパ。エンドポイント仕様は **`@README.md`** に詳細。本ファイルはコードから読み取りづらい規約・ゴッチャに限定する。

## ルール (常時適用)

@./.claude/rules/commit.md

## トピック別ルール (作業に応じて読む)

- ルート (HTTP エンドポイント) を追加・修正する → `.claude/rules/routes.md`
- service 層 (LINE WORKS API ラッパ) を触る → `.claude/rules/services.md`

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

- `src/index.ts` — エントリ。`Hono` インスタンス生成 → サブルータを `app.route(...)` で mount → `@hono/node-server` の `serve()` で起動
- `src/routes/messages.ts` — `messagesApp` (Hono) を export。`(channels|users)/:id/messages/type/<type>` を 20 エンドポイント分まとめて `app.post(...)` で登録
- `src/routes/attachments/` — `attachmentsApp` (Hono) を export。`/attachments` prefix 配下に `POST /` (upload) と `GET /:fileId` (download) をマウント
- `src/services/lineworks/` — LINE WORKS API ラッパ
  - `auth.ts` — JWT 生成 + アクセストークン取得 (`getServerToken`)
  - `api.ts` — Bot API への JSON POST 共通処理 (`postJson`, `sendBotMessage`)
  - `messages/index.ts` — 10 type 分の Zod schema + `sendMessageByType` 汎用 dispatcher (`{ type, ...body }` で組み立てて送信)
  - `attachment.ts` — アップロード / ダウンロード URL 解決
- `src/utils/config.ts` — 必須 env を起動時に検証 (fail-fast) して `config()` でアクセス
- `src/utils/logger.ts` — pino ベース logger
- `src/utils/zod-locale.ts` — Zod のエラーメッセージ日本語化マップ
- `src/types/lineworks.ts` — `MessageTarget` と `MessageSender<TBody>` の共有型 (それ以外は z.infer で導出)

## 環境変数

| 変数 | 用途 |
|---|---|
| `CLIENT_ID` | LINE WORKS API のクライアント ID |
| `CLIENT_SECRET` | クライアントシークレット |
| `SERVICE_ACCOUNT` | サービスアカウント |
| `PRIVATE_KEY` | Base64 エンコード済みプライベートキー (`base64 -i private_*.key`) |
| `BOT_ID` | Bot ID |
| `PORT` | リッスンポート (デフォルト 8080) |
| `NODE_ENV` | `production` で JSON ログを抑制せずそのまま出す (Hono 自体は logger を内蔵しないので env による分岐は最小限) |
| `LOG_PRETTY` | `1` で pino-pretty 経由のカラー出力 (development のみ有効) |

## 注意点 (コードから読めない / 読みづらいもの)

### MUST (これを破ると壊れる)

- **JWT の `aud` は固定**: `https://auth.worksmobile.com/oauth2/v2.0/token`。LINE WORKS の OAuth エンドポイント自体を `aud` にする仕様で、`auth.ts` 内の `AUTH_URL` 定数と一致させる
- **`PRIVATE_KEY` は Base64 エンコード**を前提に PEM へデコードしている (`Buffer.from(raw, 'base64').toString('utf-8')`)。生 PEM をそのまま入れると JWT 署名で失敗
- **添付ファイル取得は 3xx の Location 抽出**。LINE WORKS のダウンロード API は 3xx を返してくるため `redirect: 'manual'` で受け、`Location` ヘッダから実 URL を取り出す。`fetch` のデフォルト (follow) ではリダイレクト先に Authorization ヘッダが付与されない問題と二重に絡むので変えない
- **アクセストークンの scope は `bot` 固定**。他スコープが必要になる場合は `auth.ts` を分岐させる前に LINE WORKS 側の権限設定を確認

### よくあるハマり

- **コンテナは HTTP/1.1 のみで listen**: end-to-end h2c は **採用しない**。理由は Bun / Node の `node:http2` 単独サーバが HTTP/1.1 を併行受信できず (`allowHTTP1` は ALPN/Upgrade 経由のみ機能)、Cloud Run の Envoy は素の HTTP/1.1 を投げてくるため protocol error になる
- **公開側の HTTP/2 は Cloud Run フロントエンドが終端する**: クライアント↔Cloud Run は HTTP/2、Cloud Run↔コンテナは HTTP/1.1。`gcloud run deploy` に `--use-http2` フラグは**つけない**。webhook サーバなので multiplexing の効果は限定的
- **multipart は `c.req.parseBody()` で File を受ける**: Hono は Web 標準 (`File` / `FormData`) を使う。multer / @fastify/multipart 系の API には戻さない。サイズ制限は Hono 側に未設定なので大きすぎるファイルが来た時の対策が必要なら別途
- **README に "BASIC AUTH" の記載があるが現状未実装**。Hono なら `hono/basic-auth` ミドルウェアを `app.use('*', basicAuth({...}))` で乗せる

### Docker / デプロイ

- **マルチステージビルド**: builder で `bun install` + `bun run build` → runtime には `build/index.js` だけ COPY する。`node_modules` / `tsconfig.json` / `package.json` は runtime に**残さない**
- **runtime ベースは `oven/bun:<ver>-slim`** (debian-slim)。builder は `oven/bun:<ver>-debian` (フル) を使い分ける
- **非 root で起動**: `USER bun` (uid 1000)。COPY は `--chown=bun:bun` を付ける
- **BuildKit 限定構文は使わない**: Cloud Build のデフォルト `gcr.io/cloud-builders/docker` が BuildKit 非対応。`--mount=type=cache` / `--mount=type=secret` 等は禁止。普通のレイヤキャッシュ (`COPY package.json bun.lock` を独立ステップにする等) で代替する
- **HEALTHCHECK は `curl` を入れず `bun -e "fetch(...)"`** で `/health` を叩く。curl パッケージを入れない方針
- **CMD は `["bun", "build/index.js"]`** で直接バンドルを起動 (`bun run start` → package.json 参照を避ける)
- **`bun` のバージョンは Dockerfile 冒頭の `FROM` 2 行で固定**。`.tool-versions` と一致させる (片方だけ上げないこと)
- **`.env` は build context に入れない**: `.dockerignore` で除外済。Cloud Run へは `--set-env-vars` / `--set-secrets` で注入

### 命名・配置の慣習

- **送信先は `channelId` か `userId` の片方のみ**: `_send.ts` の `buildMessageUrl` がどちらか一方を要求する
- **メッセージタイプは `services/lineworks/messages/index.ts` の `messageSchemas` マップに集約**。新タイプを足す時はそこに schema を 1 件追加するだけで、`routes/messages.ts` のループが自動で `(channels|users)/:id/messages/type/<type>` を登録 + 汎用 `sendMessageByType` が `{ type, ...body }` を組み立てて送信する。**個別 sender 関数は書かない**
