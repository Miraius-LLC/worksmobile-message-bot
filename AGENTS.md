# worksmobile-message-bot — 全エージェント共通プロジェクト指示（Codex / Claude / agy）

LINE WORKS Bot の Webhook サーバー。Bun + TypeScript + Hono。IFTTT / Make から Webhook 経由でメッセージ送信・添付ファイルアップロード/ダウンロードを行うための薄いラッパ。エンドポイント仕様・アーキテクチャ・環境変数・主要コマンド・デプロイ手順は **`README.md`** にある。本ファイルはコードから読み取りづらい規約・ゴッチャに限定する。

このファイルは worksmobile-message-bot 固有の **SoT（実体）**。ホーム共通規約は `~/AGENTS.md` / `~/CLAUDE.md` が担保する。`CLAUDE.md` は本ファイルを `@import` する従属ラッパーで、Claude Code 固有のロード機構（`.claude/rules/` の @import / Agent skills の per-repo 設定）だけを持つ。Codex / agy は本ファイルを直読する。

回答は日本語で、結論先出し・簡潔に行う。

## ルール (常時適用)

- repo の開発規約（coding-conventions / tests / worktree / routes / services / tests-lineworks）の詳細は `.claude/rules/*.md`（Claude は `CLAUDE.md` 経由で @import、Codex / agy は同ディレクトリを直接参照）。
- commit / git-log / source-file-naming は全島共通。判断 hook は `~/.agents/AGENTS.md` §7、詳細は `~/.agents/rules/*.md` を該当時に読む。**repo には置かない**。
- 文書の SoT の分界（ADR / README・CONTEXT / OpenSpec / テスト / TODO / CHANGELOG）は [`docs/conventions/documentation.md`](./docs/conventions/documentation.md) を正とする。
- env は `src/utils/config.ts` の Zod schema が起動時に検証する（fail-fast）。一覧と本番の渡し方は [`README.md`](./README.md#環境変数の設定)。`pre-commit` で biome auto-fix と `tsc --noEmit` が走る。

## トピック別ルール (作業に応じて読む)

- ルート (HTTP エンドポイント) を追加・修正する → `.claude/rules/routes.md`
- service 層 (LINE WORKS API ラッパ) を触る → `.claude/rules/services.md`
- LINE WORKS 関連のテストパターン (典型モック / app.request / multipart) → `.claude/rules/tests-lineworks.md`
- HTTP API contract、入力 validation、状態・不変条件、認証境界、callback・外部 API 連携の観測可能な挙動を変える → 実装前に OpenSpec active change を作る。適用基準は [`docs/conventions/documentation.md`](./docs/conventions/documentation.md)
- Docker / Cloud Build / Cloud Run を触る → [ADR-0008](./docs/adr/0008-docker-cloud-build-constraints.md)・[ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md) と [`README.md`](./README.md#docker-イメージの実装上の注意)

## 注意点 (コードから読めない / 読みづらいもの)

### MUST (これを破ると壊れる)

- **JWT は `node:crypto` で自前生成 + `aud` 固定** ([ADR-0003](./docs/adr/0003-jwt-node-crypto-rs256.md))。`auth.ts` 内の `AUTH_URL` 定数 (`https://auth.worksmobile.com/oauth2/v2.0/token`) を `aud` と一致させる。仕様変更時は base64url エンコードと改行に注意
- **`PRIVATE_KEY` は Base64 エンコード**を前提に PEM へデコードしている。生 PEM をそのまま入れると JWT 署名で失敗。`config.ts` の Zod schema が起動時に PEM 含有チェックする
- **添付ファイル取得は 3xx の Location 抽出**。LINE WORKS のダウンロード API は 3xx を返してくるため `redirect: 'manual'` で受け、`Location` ヘッダから実 URL を取り出す。`fetch` のデフォルト (follow) ではリダイレクト先に Authorization ヘッダが付与されない問題と二重に絡むので変えない
- **アクセストークンの scope は `OAUTH_SCOPE` で選択可能** (`bot.message` / `bot` / `bot.read`)。未指定時はデフォルトの `bot` が適用される
- **`getServerToken` はキャッシュ + single-flight 済み**。直接 `fetch` を叩き直す変更は避け、`auth.ts` の `cached` / `inFlight` の状態管理を尊重する

### よくあるハマり

- **コンテナは HTTP/1.1 のみで listen / end-to-end h2c は採用しない** ([ADR-0002](./docs/adr/0002-container-http1-only-no-h2c.md))。公開側 HTTP/2 は Cloud Run フロントが終端、コンテナは HTTP/1.1。`gcloud run deploy` に `--use-http2` は**つけない**
- **multipart は `c.req.parseBody()` で File を受ける**: Hono は Web 標準 (`File` / `FormData`) を使う。multer / @fastify/multipart 系の API には戻さない。アップロードサイズは `attachments/index.ts` の `bodyLimit({ maxSize: 10 * 1024 * 1024 })` で 10MB 上限
- **route handler は try/catch しない**: throw されたエラーは `app.ts` の `app.onError` が拾って `{ error: message }` を 500 で返す (`LineWorksApiError` / `HTTPException` は下記のとおり透過)。各ハンドラから 500 を直接返す書き方はしない (validation 400 など期待エラーを除く)。例外は、後始末 (callback の dedup key の `unregister` など) をして同じエラーを再 throw する try/catch だけ
- **token は middleware 経由**: `routes/_middleware.ts` の `tokenMiddleware` が `c.var.token` に注入する。各ハンドラで `await getServerToken()` を呼ばない
- **BASIC 認証は `app.ts` で `/` と health probe / `/callback` 以外に強制** ([ADR-0006](./docs/adr/0006-basic-auth-except-health-and-callback.md))。`hono/basic-auth` を lazy 初期化 + `PUBLIC_PATHS` で除外。`/healthz` を正、`/health` / `/readyz` / `/livez` は互換エイリアスで同じハンドラを共有 (`HEALTH_PATHS` 配列で集中管理)
- **`app.onError` は `HTTPException` を `getResponse()` で素通り**: `basicAuth` 等 Hono ミドルウェアが投げる HTTPException を 500 で潰さないため (LineWorksApiError 透過と同じパターンで明示分岐)
- **callback 検証と同期 await 転送**: 署名検証 → Bot ID 検証 (`X-WORKS-BotId` 欠落 400 / 不一致 403) → dedup チェック → JSON/Zod 検証 → upstream へ同期 await 転送を行う。失敗時は 500 + ログ出力とし、dedup key を `unregister` して手動再投入を受け入れる。JSON/Zod 検証で 400 を返すときも key を `unregister` し、同じ不正 payload の再送を 200 で素通りさせない。これは LINE WORKS の自動再送契約を前提としない。
- **callback dedup は in-memory Map で 5 分 window の best effort** ([ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md))。Workers isolate 間や Cloud Run instance 間で Map は共有されない。
- **callback は設定可能な upstream へ転送する** ([ADR-0005](./docs/adr/0005-forward-callback-to-upstream.md))。`callback/forward.ts` が env `FORWARD_CALLBACK_URL` へ raw body と `X-WORKS-Signature` を転送する。業務固有の応答処理は upstream の責務であり、wmbot 内にはローカル handler を持たない

### Docker / デプロイ

- **`bun` のバージョンは Dockerfile 冒頭の `FROM` 2 行で固定**。`.tool-versions` と一致させる (片方だけ上げないこと)
- **機密 env を Cloud Run の env に直書きしない** ([ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md))。Secret Manager の `:latest` を参照するので、`gcloud secrets versions add` だけで再 deploy なしに差し替えられる
- **Workers / Cloud Runの両方をサポートする**: 共通Hono appを`src/worker.ts`と`src/index.ts`から起動する。どちらを採用するかは利用者の運用要件で決め、リポジトリ内に特定環境の主系・待機系を固定しない。

### 命名・配置の慣習

- **送信先は `channelId` か `userId` の片方のみ**: `messages/index.ts` の `buildMessageUrl` がどちらか一方を要求する
- **メッセージタイプは `messageSchemas` マップに集約 + 個別 sender なし** ([ADR-0007](./docs/adr/0007-message-type-dispatcher.md))。新タイプは `services/lineworks/messages/index.ts` に schema を 1 件足すだけで `routes/messages.ts` のループが `(channels|users)/:id/messages/type/<type>` を自動登録、`sendMessageByType` が `{ type, ...body }` を組み立てて送る
- **`_`で始まるファイルは内部ヘルパ**: `routes/_middleware.ts`のように、サブルータへ直接mountしない補助moduleであることを示す。

<!-- BEGIN develop-meta:AGENTS.md v1 sha256=9fb5f6042627c7d57a489c52e53720ea9fb28c8a31f28a759dec80646c52ce00 -->
### 3.1 目的に対して過不足なく

- **範囲は最小**: 目の前の問題は原因まで直す。起きていない問題・依頼に無い機能・将来用の拡張点・同じ性質を重ねる守りは足さない。範囲外の発見は、すぐ直せるものは報告し、重いものは TODO へ。
- **質は落とさない**: その場しのぎで症状だけ止めない。モデル名・repo 名・path・閾値のような可変値は分岐やリテラルに埋めず、その責務を持つ定数か既存の設定 1 か所に置く（モデル名で `if` を書かず、能力の表を引く）。同じ責務で一緒に変わる処理は共通の関数へ寄せ、内部の状態や手順は呼出側へ漏らさない。似ているだけなら寄せない。ループ内の I/O・N+1・全件読込のように計算量を増やす書き方はしない。整えるのは今回の変更に必要な範囲まで。「変えやすく書く」は「将来の変更を先に作る」ではない。
- **検証は壊れた時の被害で決める**: データ・権限・本番・配布に関わる判定はテストで証明し、壊して落ちることを確かめる（L69）。既存テストで証明済みなら足さない。文言や表示だけの変更にテストを足さない。網羅のためのマトリクスは作らない。
- **review は根拠で判定する**: blocker は (a) 今回の範囲の誤動作を再現手順かコード・仕様で示せるもの、(b) 本節「質」に反する箇所を `file:line` で示せるもの。reviewer がどちらも示せない指摘は理由を記録して閉じる。再 review は修正箇所と影響範囲に絞り、解決済みの論点は新しい根拠が無ければ再開しない。blocker かどうかの判定が割れたら 藤井 に判断を渡す。

<!-- END develop-meta:AGENTS.md -->
