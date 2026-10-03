# Changelog

LINE WORKS Bot Webhook サーバーの整備履歴。完了の節目だけを残し、commit 単位の詳細は `git log` を参照する。

> 古い分は git 履歴に任せる。

## 2026-10

- **callback転送のredirectを失敗扱いにした（2026-10-04）**: redirectを自動追従せず、upstreamの3xxとopaque redirectで転送失敗としてdedup keyを解除する。仕様差分は[active change](openspec/changes/callback-forward-redirect-safety/proposal.md)。

## 2026-09

- **不正 callback の再送が 200 で素通りしないようにした（2026-09-27）**: JSON / Zod で `400` を返すときも dedup key を `unregister` する。正常 payload の重複 skip は変えない。
- **AGENTS.md の構成記述を実装に合わせた（2026-09-27）**: Hono の生成・middleware・mount・onError は `src/app.ts`、`src/index.ts` は config 検証・serve・SIGTERM。後始末して再 throw する場合は try/catch を許す。
- **拡張手順 3 件を docs へ移した（2026-09-16）**: メッセージ型の追加、callback event type の追従、AFK-agent の有効化を各文書へ一本化した。TODO は進行中と未着手だけ。
- **secret 注入の出力を 0600 の atomic 置換にした（2026-09-02）**: 失敗時は既存ファイルを残し、symlink 先は拒否する。共通契約は v4。

## 2026-08

- **secret 注入の失敗系テストが実時間で待たないようにした（2026-08-27）**: `sleep` を options から渡し、失敗系には no-op を渡す。
- **Socket scanner の失敗で install ごと落ちないようにした（2026-08-27）**: scanner 由来の失敗だけ再試行し、push の CI で全滅したときだけ scanner 無しで install する。
- **deploy する wrangler の版を install 済みの実体から取るようにした（2026-08-27）**: `bunx wrangler --version` の値を渡し、版として読めなければその場で止める。
- **`bun.lock` のヘッダと Biome の `$schema` を固定した（2026-08-27）**: 実行表記は Cloudflare Workers / Bun 1.4.x + Cloud Run。lockfile のヘッダと CLI の schema がずれないようにした。
- **既存 ADR の現行契約を OpenSpec の baseline にした（2026-08-25）**: ADR-0001 は独立 spec に戻さず、ADR-0010 への系譜として参照する。ADR と current spec は双方向に結ぶ。
- **OpenSpec を repository-local に入れた（2026-08-25）**: 観測できる契約の変更を active change で管理する。既存仕様の backfill は後続に残した。
- **`bun run spec:validate` を共通の検証入口にした（2026-08-25）**: local、pre-push、CI で telemetry 無しの strict validation を走らせる。
- **CodeGraph の設定を fresh worktree でも使えるようにした（2026-08-25）**: local DB は追跡せず、Agent 配布物は `codegraph.json` で除外する。
- **一覧 query の `count` / `cursor` を共通化した（2026-08-25）**: 空の `count` は未指定。範囲は `1..100` のまま。
- **callback を gateway の責務に限った（2026-08-25）**: 実行経路から呼ばれないローカル dispatch を削除した。署名、Bot ID、dedup、同期転送は残す。
- **Hono を 4.13.4 へ上げた（2026-08-25）**: 依存を更新した。
- **`op read` が承認待ちに入れるようにした（2026-08-18）**: stdin を継承し、デスクトップアプリの承認を待てるようにした。
- **secret 取得の一時失敗を取り直すようにした（2026-08-18）**: 単発の失敗は間隔を空けて直列で最大 2 回読む。認証が必要な失敗は即中断する。
- **secret 注入の共通契約を v3 にした（2026-08-18）**: `read-inherits-stdin` と `resolve-transient-retry` を足した。
- **リッチメニュー画像登録を公式の JSON API に合わせた（2026-08-13）**: `fileId` / `i18nFileIds` で `204 No Content`。Bot 設定の schema も公式仕様へ合わせた。
- **リッチメニュー操作と一覧の pagination を足した（2026-08-13）**: 12 操作と、一覧の `count` / `cursor` / `nextCursor` を扱う。
- **公開 route の HTTP status を公式仕様に合わせた（2026-08-13）**: 作成系は `201`、リッチメニュー画像登録は `204`。
- **OAuth scope を選べるようにした（2026-08-13）**: `bot.message` / `bot.read` / `bot`。未設定時は `bot`。
- **Callback の Bot ID 検証と同期 await を入れた（2026-08-13）**: Bot ID の欠落は `400`、不一致は `403`。失敗時は `500` とログ。`unregister` は手動再投入用。
- **Callback の dedup を 5 分の in-memory にした（2026-08-13）**: raw body の SHA-256 を key にする。転送失敗時は key を外す。
- **`secrets:inject` を正規の入口にした（2026-08-13）**: `.env` のマージをこのコマンドが直接呼ぶ。`secrets:check` は書き込まない。
- **`secrets:dump` で `.env` を生成できるようにした（2026-08-13）**: `.env.tpl` の `op://` を正とし、値は表示しない。のちに `secrets:inject` へ一元化した。
- **稼働監視と Cloud Run のログ監視を分けた（2026-08-11）**: `setup-monitoring.sh` は HTTPS の uptime だけを扱う。ログ指標は別 script。
- **公開できない ADR を二層の digest 付き記録へ整理した（2026-08-11）**: ADR-0001 / 0004 / 0005。公開時の redaction の分界は ADR-0011。
- **`secrets:dump` の alias を現行入口から外した（2026-08-10）**: 入口は `secrets:inject` と `secrets:check`。契約は v2。内部の entrypoint は残した。
- **検証済み callback を upstream へ転送するようにした（2026-08-10）**: raw body と署名を保って `FORWARD_CALLBACK_URL` へ送る。未設定なら転送せず `200`。
- **Workers と Cloud Run の両方へ deploy できるようにした（2026-08-10）**: Workers は Wrangler、Cloud Run は Docker と Cloud Build。Custom Domain は GitHub Variable から作る。
- **secret 注入契約 v1 の適合検査を固定した（2026-08-10）**: managed block の置換、失敗時の no-write、template の key 一致を、実 secret を使わず検査する。
- **Cloud Run と Hono と Bun を採用した（2026-08-10）**: 環境固有値は runtime SA、Secret Manager、substitution に置き、公開 repo に残さない。

## 2026-07

- **既存 ADR 9 件を共通形式へ移した（2026-07-12）**: 移行前の Markdown と SHA-256 を Original Record に残し、全 ADR を共通の監査対象にした。
- **`scripts/` を Biome と関連テストの対象にした（2026-07-01）**: 関連テストの抽出を分け、監視設定の uptime config は重複して取らない。

## 2026-05

- **Callback の受信と event の振り分けを足した（2026-05-23）**: `POST /callback` で署名を検証し、event 8 種を分ける。
- **メッセージ型を schema のマップで送るようにした（2026-05-23）**: 型を 1 件足すと route が登録される。各型は Zod で起動時に検査する。
- **添付の upload と download を足した（2026-05-23）**: upload は 10MB まで。download は 3xx の `Location` を取る。
- **server token をキャッシュし、同時取得を 1 本にした（2026-05-23）**: JWT は RS256。route は middleware の token を使う。
- **トークルーム、ドメインメンバー、Bot の CRUD を足した（2026-05-23）**: 固定メニューとリッチメニュー、テナントとドメイン別の Bot 設定を含む。
- **health と `/callback` 以外に BASIC 認証を掛けた（2026-05-23）**: `/healthz` を正とし、`/callback` は署名検証で代替する。
- **本番 Bot の削除と Secret 再発行を確認なしでは拒否するようにした（2026-05-23）**: `?confirm=<botId>` が無い `DELETE` と `POST /secret` は 403。
- **外部 fetch に timeout を掛けた（2026-05-23）**: upstream がハングしても待ち続けない。
- **request を 1 行で残す middleware を足した（2026-05-23）**: 全 request を 1 行にする。
- **ログを Cloud Logging の severity と trace に合わせた（2026-05-23）**: `x-cloud-trace-context` を保持し、project があるときは resource name 形式で出す。
- **Cloud Build に `bun test` を足した（2026-05-23）**: `--no-verify` で pre-push を飛ばしても、build でテストが走る。
- **コンテナは HTTP/1.1 だけを listen するようにした（2026-05-23）**: 公開側の HTTP/2 は Cloud Run のフロントが終端する。
- **設計記録と用語と agent 文書の土台を置いた（2026-05-23）**: ADR、`CONTEXT.md`、`docs/agents/` を置き、engineering skills を同期した。
