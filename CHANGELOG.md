# Changelog

LINE WORKS Bot Webhook サーバーの整備履歴。**完了の節目で更新**し、コミット単位の詳細は `git log` を参照する（本ファイルは git log と重複しない粒度に保つ）。日付は逆順。

## ADR contractのOpenSpec baseline — ✅ 2026-08-25

- **既存ADRを7 capabilityへ整理**: ADR-0001〜0011の現行contractを、判断理由を複製しないcurated baselineとしてOpenSpecへ反映した。supersededのADR-0001は独立specへ復活させず、ADR-0010へ至る系譜として`dual-runtime-deployment`から参照する。
- **双方向coverageを固定**: 各ADRと対応current specを双方向linkし、11 ADRの過不足ないmappingとADR-0001の非独立化をrepository testで検証する。

## OpenSpec・コード探索基盤 — ✅ 2026-08-25

- **OpenSpecを段階導入**: OpenSpec 1.10.0をrepository-localに固定し、API contract、入力validation、状態・不変条件、認証境界、外部連携の観測可能な変更をactive changeで管理する。導入時点では既存仕様をbackfillせず、後続changeでaccepted ADR由来のcurated baselineを追加した（[workflow spec](./openspec/specs/change-specification-workflow/spec.md)）。
- **検証経路を統一**: `bun run spec:validate`をlocal、pre-push、CIの共通入口にし、telemetry無効のstrict validationを実行する。
- **CodeGraph設定をportable化**: 既存のGraphify / CodeGraph連携を維持し、fresh worktreeでもlocal DBを追跡しない`.codegraph/.gitignore`とAgent配布物を除外する`codegraph.json`を追加した。

## pagination共通化とcallback責務整理 — ✅ 2026-08-25

- **一覧queryの共通化**: Bot、Botドメイン、リッチメニュー、トークルームメンバー、ドメインメンバーの`count` / `cursor` schemaと400応答hookを共通化した。IFTTT / Makeが送る空の`count`は未指定として扱い、`1..100`の範囲制約は維持する。
- **callbackをgateway責務へ限定**: ADR-0005に従い、実行経路から呼ばれないローカルdispatch / reply / handler雛形と専用テストを削除した。署名・Bot ID検証、dedup、upstreamへの同期await転送は維持する。
- **依存更新**: Honoを4.13.4へ更新した。

## secret 注入の承認待ちと拾い直し — ✅ 2026-08-18

- **`op read` の stdin を継承**: `Bun.spawn` は既定で stdin を塞ぐため、`op` が 1Password デスクトップアプリの承認待ちへ入れず `connecting to desktop app timed out` で失敗していた。承認がキャッシュ済みの端末では成功するので、承認が要る Linux の dev 機で初めて露見する（501 が 2026-08-13、asunaro が 2026-08-18 に実測）。`stdin: 'inherit'` へ変更し、spawn option を固定する回帰テストを追加した。
- **一時的失敗の拾い直し**: 並列読みで単発失敗した参照を 500ms・1500ms と間隔を空けて直列で最大 2 回読み直す。`connecting to desktop app` は専用分類にし、生 reason は従来どおり表示しない。`認証が必要` は即中断、`opコマンドなし` と `値が空` は再試行しない。
- **共通契約 v3**: develop-meta の secret 注入契約へ `read-inherits-stdin` / `resolve-transient-retry` を追加し、対象 4 repo で揃えた。

## 公式 Bot API 追従・Callback 契約整理 — ✅ 2026-08-13

- **公式 Bot API 契約の同期**: リッチメニュー画像登録を公式 `fileId` / `i18nFileIds` JSON API（`204 No Content`）へ変更し、ドメイン別 Bot 設定、Bot テナント設定の schema を公式仕様へ同期した（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- **リッチメニュー操作と一覧 pagination**: 詳細・画像情報・ユーザー別・デフォルト操作を含む全 12 操作に対応し、Bot / ドメイン / リッチメニュー一覧で `count` / `cursor` / `responseMetaData.nextCursor` を扱うようにした。
- **公開 route の HTTP status 同期**: メッセージ送信、作成系は `201`、リッチメニュー画像登録は `204` とし、公式仕様の契約テストを固定した。
- **OAuth scope の選択対応**: `OAUTH_SCOPE` で `bot.message` / `bot.read` / `bot` を設定可能にした。未設定時のデフォルトは `bot` とする。
- **Callback の検証と同期 await 方針**: `X-WORKS-BotId` 検証（欠落 `400` / 不一致 `403`）を追加した。公式 Callback ページで自動再送契約を確認できないため、Cloud Run / Workers 共通で同期 await 転送、失敗時は `500` + ログ出力、`unregister` は手動再投入用として整理した。

## ドキュメント

- 既存ADR 9件を移行前Markdown・SHA-256付きOriginal Recordを持つ共通形式へ移行し、全ADRを共通監査対象化。
- 公開repositoryへ置けない環境固有情報を含むADR-0001/0004/0005を二層digest付きSanitized Original Recordへ整理し、公開redactionの責任分界をADR-0011へ記録。

## secret 注入 P4: 旧 alias 撤去 — ✅ 2026-08-10

- `package.json` と現行運用 docs から `secrets:dump` alias の案内を撤去し、`secrets:inject` / `secrets:check` の正規入口へ統一した。conformance adapter/test は contract v2 へ更新し、内部 entrypoint `scripts/dump-secrets-to-env.ts` と旧 managed header の読み取り互換は維持した。

## 受信（Callback）系

- **Callbackを設定可能なupstreamへ転送**: 検証済みcallbackをraw bodyと署名を保ったまま`FORWARD_CALLBACK_URL`へ転送するgateway方式を採用（[ADR-0005](./docs/adr/0005-forward-callback-to-upstream.md)）。未設定時は転送せず`200`を返す。
- **Callback dedup（5分window）**: raw bodyのSHA-256をkeyにしたin-memory Mapで重複を抑止する。Workers isolate間やCloud Run instance間ではbest effortであり、厳密な一回処理は共有ストアまたはupstream側idempotencyで担保する（[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。転送失敗時はkeyを解除し、手動再投入を受け入れられるようにする（LINE WORKSの自動再送契約は前提にしない）。
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

- **基盤共通uptime監視とCloud Runログ監視を分離**: `setup-monitoring.sh`はHTTPS uptime監視だけを扱い、Cloud Run固有のログ指標・通知は明示実行する別scriptへ分離。Cloud Buildの環境固有値はtriggerまたはmanual buildのsubstitutionで渡せることを明文化した。
- **Workers / Cloud Runの両deploy経路**: 共通Hono appをWorkersはWrangler + GitHub Actions、Cloud RunはDocker + Cloud Buildでデプロイできる構成にした（[ADR-0010](./docs/adr/0010-dual-cloud-deployment.md)）。Custom Domainは公開設定に固定せずGitHub Variableから生成する。
- **secret 注入 contract v1 の conformance 固定**: `template` adapter と共通 scenario ID を追加し、managed block の置換・quote、env 優先 / 強制再取得、未サインイン時の直列停止、並列数上限、check の決定順・値非表示・非書き込み、取得失敗時 no-write、package scripts、tracked template の key / `op://` 参照一致をテストで固定。runner は I/O と `op read` を注入可能にし、実 secret や `.env` を使わず安全性を検証する。
- **ローカル secret 注入の正規入口を `secrets:inject` に統一**: 既存の安全な `.env` マージ実装を `secrets:inject` が直接呼び、`.env.tpl`・README・AGENTS の現行案内も正規名へ同期した。旧 `secrets:dump` は 2026-08-10 の P4 で現行入口から撤去し、`secrets:check` の非書き込み契約は維持する。
- **1Password から `.env` を生成する `secrets:dump` を追加（歴史的記録）**: `.env.tpl` の `op://` 参照を SoT として読み、値を表示せず `.env` へマージ保存する実装を追加した。その後 `secrets:inject` へ完全一元化し、旧 alias を撤去した。
- **scripts の検証対象化**: pre-commit / CI / package scripts の Biome 対象に `scripts/` を追加し、`run-related-tests.ts` の関連テスト抽出ロジックを unit test 付きで分離。監視設定スクリプトは uptime config の重複取得を削減。
- **Cloud Build に bun test step を追加**: ビルドパイプラインに `bun test` を組み込み、`--no-verify` での pre-push バイパスを防止（[ADR-0008](./docs/adr/0008-docker-cloud-build-constraints.md) / [ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md)）。`cloudbuild.yaml` が Cloud Run 構成（runtime SA / Secret Manager マウント / scaling / resources / ingress）の SoT。
- **HTTP/1.1-only（end-to-end h2c 不採用）**: コンテナは HTTP/1.1 のみで listen し、公開側 HTTP/2 は Cloud Run フロントが終端（`--no-use-http2`、[ADR-0002](./docs/adr/0002-container-http1-only-no-h2c.md)）。
- **Cloud Run + Hono + Bunの採用**: コンテナruntimeの選択肢としてCloud Runを採用（[ADR-0001](./docs/adr/0001-cloud-run-hono-bun.md)）。runtime SA + Secret Manager + substitution variableで環境固有値を公開リポジトリに残さない（[ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md)）。
- **mattpocock engineering skills の per-repo 土台**: 設計決定を `docs/adr/`（9 ADR）に backfill、用語集を root `CONTEXT.md` に新設、`docs/agents/{issue-tracker,domain}.md` + CLAUDE.md `## Agent skills` ブロックを整備。engineering skills を SoT から配布同期。

## スタック

| 層 | 採用 |
|---|---|
| ランタイム / 実行 | Cloudflare Workers / Bun 1.4.x + Cloud Run |
| HTTP フレームワーク | Hono（Workers）+ @hono/node-server（Cloud Run） |
| Validation | Zod + @hono/zod-validator |
| Linter / Formatter | Biome 2.x |
| Logger | pino（+ pino-pretty in dev）、Cloud Run時はCloud Logging severity / trace連携 |
| CI / CD | GitHub Actions（Workers）/ Cloud Build（Cloud Run） |
| pre-commit / pre-push | lefthook（biome auto-fix + tsc + 関連テスト / 全件テスト） |
