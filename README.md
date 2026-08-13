# Webhook Bot Messenger for LINE WORKS

![Bun](https://img.shields.io/badge/-Bun-000000.svg?logo=bun&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6.svg?logo=typescript&logoColor=white&style=flat-square)
![Hono](https://img.shields.io/badge/-Hono-E36002.svg?logo=hono&logoColor=white&style=flat-square)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020.svg?logo=cloudflareworkers&logoColor=white&style=flat-square)
![Google Cloud Run](https://img.shields.io/badge/Cloud_Run-4285F4.svg?logo=googlecloud&logoColor=white&style=flat-square)
![Biome](https://img.shields.io/badge/-Biome-60A5FA.svg?logo=biome&logoColor=white&style=flat-square)
![LINE WORKS](https://img.shields.io/badge/-LINE_WORKS-00C300.svg?logo=line&logoColor=white&style=flat-square)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)

[LINE WORKS API](https://developers.worksmobile.com/jp/docs/api)を利用して各種メッセージ（テキスト、画像、ファイル、カルーセルなど）をBotから送信するWebhookサーバー。[IFTTT](https://ifttt.com/)や[Make](https://www.make.com/)などからWebhook経由でLINE WORKS Botを利用できる。

同じHono appをCloudflare Workers / Cloud Runのどちらでもデプロイできる。Workers向けの
Wrangler構成と、Cloud Run向けのDocker / Cloud Build構成を同じリポジトリで維持している。

### 技術スタック

- **実行基盤**: Cloudflare Workers / Google Cloud Run
- **ランタイム**: Workers runtime / [Bun](https://bun.sh/) 1.3.x（Cloud Run・ローカル）
- **言語**: TypeScript (ESM, strict)
- **HTTP フレームワーク**: [Hono](https://hono.dev/)（Workers と Cloud Run で共通 app を実行）
- **検証**: [Zod](https://zod.dev/) + [@hono/zod-validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator)
- **Linter / Formatter**: [Biome](https://biomejs.dev/) 2.x
- **Logger**: [pino](https://github.com/pinojs/pino) (+ pino-pretty in dev) — Workers logs / Cloud Run時のCloud Logging severity・trace連携
- **pre-commit**: [lefthook](https://github.com/evilmartians/lefthook)
- **CI**: GitHub Actions (PR + `main` への push で `tsc --noEmit` + `biome check` + `bun test`)
- **CD**: GitHub Actions (CI 成功後) → Cloudflare Workers / Cloud Build → Cloud Run

### 参考にさせていただいた記事

- [チュートリアル - 応答 Bot を作る | LINE Developers](https://developers.line.biz/ja/docs/messaging-api/nodejs-sample/)
- [Make で LINE WORKS API を実行してみる (OAuth2.0) #LINEWORKS - Qiita](https://qiita.com/mmclsntr/items/98922edd6046d4294a23)
- [【Node.js × LINE WORKS API】API で BOT を登録する #初心者向け - Qiita](https://qiita.com/kunihiros/items/33e6ddf11ba9b08835d9)

---

## 環境変数の設定

ローカルの `.env` は 1Password から生成する。

```sh
bun run secrets:inject
```

`secrets:inject` は `.env.tpl` の `op://` 参照を読み、値を表示せず `.env` にマージする。既存の `.env` にある未管理キーやコメントは残る。`secrets:check` は書き込まずに 1Password 参照の疎通だけ確認する。

手動で作成する場合は以下を設定する。

```env
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
SERVICE_ACCOUNT=your_service_account
PRIVATE_KEY=your_private_key_base64_encoded
BOT_ID=your_bot_id
BOT_SECRET=your_bot_secret
BASIC_ID=your_basic_auth_username
BASIC_PASS=your_basic_auth_password

# 任意
PORT=8080         # listen ポート (default 8080)
LOG_PRETTY=1      # 開発時のみ。pino-pretty でカラー出力
OAUTH_SCOPE=bot   # (任意) OAuth 認可スコープ: bot (default) | bot.message | bot.read
```

| 変数 | 内容 |
|---|---|
| `CLIENT_ID` | LINE WORKS API のクライアント ID |
| `CLIENT_SECRET` | クライアントシークレット |
| `SERVICE_ACCOUNT` | サービスアカウント |
| `PRIVATE_KEY` | Base64 エンコードされたプライベートキー (`base64 -i ./private_XXXXXX.key \| pbcopy`) |
| `BOT_ID` | Bot ID |
| `BOT_SECRET` | Bot Secret (Callback の `X-WORKS-Signature` HMAC-SHA256 検証鍵)。Developer Console の Bot 詳細から取得 |
| `BASIC_ID` | webhook 公開エンドポイント保護用の BASIC 認証ユーザ名 |
| `BASIC_PASS` | BASIC 認証パスワード |
| `FORWARD_CALLBACK_URL` | (任意) 受信Callbackを転送するupstream serviceのURL。未設定なら転送せず200を返す |
| `OAUTH_SCOPE` | (任意) OAuth 認可スコープ (`bot` / `bot.message` / `bot.read`)。未設定時は `bot` |
| `PORT` | listen ポート (省略時 `8080`) |
| `NODE_ENV` | `production` でログレベルを `warn` 以上に絞る (4xx は warn で残しつつ Error Reporting には乗せない運用)。development では `debug` まで出す |
| `LOG_PRETTY` | `1` で pino-pretty 経由のカラー出力 (development のみ有効) |
| `GOOGLE_CLOUD_PROJECT` | Cloud Run 上で設定すると Cloud Logging trace 連携が fully-qualified resource name 形式 (`projects/<id>/traces/<traceId>`) で出る (`cloudbuild.yaml` のデプロイ step で自動注入される) |

### OAuth Scope の運用と注意点

LINE WORKS API 呼び出しに使用する OAuth 認可スコープは環境変数 `OAUTH_SCOPE` で選択可能です。

- **未設定時**: デフォルト値 `bot` が使用され、既存利用者の挙動を変更しません。
- **`bot.message`**: メッセージ送信・メッセージ受信・メニュー（固定/リッチ）・トークルーム（チャンネル）操作・コンテンツ（添付ファイル）送受信を中心に利用する場合のスコープ。
- **`bot`**: Bot CRUD やドメイン管理を含む現行すべての機能を利用する場合のスコープ。
- **`bot.read`**: GET 可能な読み取り専用 API の範囲で[公式 API ドキュメント](https://developers.worksmobile.com/jp/docs/auth-scope)を確認のうえ利用するスコープ。
  > ⚠️ **注意**: `bot.read` ではメッセージ送信や Bot 更新などの書き込み系 route (write route) は動作せず、公式 API から認可エラー (403 等) が返されます。本サーバーではローカル事前拒否を行わず公式 API のエラーをそのまま返却します。

---

## セットアップ手順

事前に [Bun](https://bun.sh/) をインストール (`.tool-versions` に対応した [asdf](https://asdf-vm.com/) / [mise](https://mise.jdx.dev/) 等を推奨)。

```zsh
# 1. クローン
$ git clone <repository-url> && cd worksmobile-message-bot

# 2. 依存インストール
$ bun install

# 3. .env 作成 (上記参照)

# 4. 起動
$ bun run dev      # 開発: ホットリロード + pretty log。localhost:8080
$ bun run build && bun run start  # 本番ビルド + 起動
```

### 主要コマンド

| 用途 | コマンド |
|---|---|
| 開発サーバ起動 (ホットリロード) | `bun run dev` |
| 型チェック | `bunx tsc --noEmit` |
| Lint / format (auto-fix) | `bunx biome check --write ./src ./tests ./scripts` |
| 本番ビルド (`build/index.js` を出力) | `bun run build` |
| 本番ビルドを起動 | `bun run start` |
| Docker イメージビルド | `bun run docker:build` |
| pre-commit hook 有効化 | `bun run lefthook:install` |
| 1Password から `.env` 生成 | `bun run secrets:inject` |
| 1Password 参照の疎通確認 | `bun run secrets:check` |

`pre-commit` で biome auto-fix と `tsc --noEmit` が走るため、手動で先回り実行する必要は無い。

---

## Cloud Run へのデプロイ

Cloud Runでは、DockerイメージをCloud Buildでビルドし、Secret Managerの値をマウントして
デプロイする。`cloudbuild.yaml` にruntime SA / scaling / resources / ingressなどを明示し、
Cloud Runへ単独でデプロイできる構成を維持している。

`cloudbuild.yaml` には **runtime SA / Secret Manager マウント / scaling / resources / ingress** 等を全て明示してあり、Cloud Run の構成 drift を防止します。

### 初回設定

```sh
# 1. 専用 runtime SA を作成
gcloud iam service-accounts create worksmobile-message-bot-sa \
  --display-name="worksmobile-message-bot runtime"

# 2. 機密 env を Secret Manager に投入
echo -n "$CLIENT_SECRET_VALUE" | gcloud secrets create lineworks-client-secret --data-file=-
echo -n "$PRIVATE_KEY_VALUE_BASE64" | gcloud secrets create lineworks-private-key --data-file=-
echo -n "$BASIC_AUTH_USERNAME" | gcloud secrets create lineworks-basic-id --data-file=-
echo -n "$BASIC_AUTH_PASSWORD" | gcloud secrets create lineworks-basic-pass --data-file=-
echo -n "$BOT_SECRET_VALUE" | gcloud secrets create lineworks-bot-secret --data-file=-

# 3. SA に accessor 権限を付与 (per-secret)
for s in lineworks-client-secret lineworks-private-key lineworks-basic-id lineworks-basic-pass lineworks-bot-secret; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:worksmobile-message-bot-sa@<PROJECT_ID>.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done

# 4. 機密度の低い env は Cloud Build の substitution variable として渡す
#    (公開リポに値を残さないため。triggerなら設定画面、manual buildなら
#    gcloud builds submitの--substitutionsを使用する)
#      _SERVICE_ACCOUNT      = Cloud Run runtime service account
#      _CLIENT_ID            = LINE WORKS の client ID
#      _SERVICE_ACCOUNT_LW   = LINE WORKS の service account (例: lrpkq.serviceaccount@xxx)
#      _BOT_ID               = LINE WORKS の bot ID
#      _FORWARD_CALLBACK_URL = callbackの転送先URL（任意）
#      _OAUTH_SCOPE          = OAuth認可スコープ (任意, 省略時 bot)

# 5. Cloud Build trigger を作成する場合は cloudbuild.yaml を指定し、
#    main などデプロイ対象の branch と substitution variables を設定する。

# 6. triggerを使わないmanual buildでは、Gitの実値と必須substitutionを明示する
(
  set -euo pipefail
  if ! git diff --quiet || ! git diff --cached --quiet || \
    [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo "ERROR: manual buildはclean working treeから実行してください" >&2
    exit 1
  fi
  REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
  COMMIT_SHA="$(git rev-parse HEAD)"
  SHORT_SHA="$(git rev-parse --short=7 HEAD)"
  gcloud builds submit . --config=cloudbuild.yaml \
    --substitutions="REPO_NAME=${REPO_NAME},COMMIT_SHA=${COMMIT_SHA},SHORT_SHA=${SHORT_SHA},_SERVICE_ACCOUNT=${CLOUD_RUN_RUNTIME_SA},_CLIENT_ID=${CLIENT_ID},_SERVICE_ACCOUNT_LW=${SERVICE_ACCOUNT},_BOT_ID=${BOT_ID},_FORWARD_CALLBACK_URL=${FORWARD_CALLBACK_URL:-},_OAUTH_SCOPE=${OAUTH_SCOPE:-}"
)
```

`_SERVICE_ACCOUNT` / `_CLIENT_ID` / `_SERVICE_ACCOUNT_LW` / `_BOT_ID`はsecretではないが、
manual buildではprocess argvとCloud Build metadataから、その環境の権限者に見える。secret値は
`--substitutions`へ渡さず、Secret Manager参照を使う。

### Cloud Run Secret Manager のローテーション

Cloud Run は `:latest` を参照しているので、**再デプロイ無し**で値だけ更新可能:
```sh
echo -n "$NEW_VALUE" | gcloud secrets versions add lineworks-client-secret --data-file=-
# Cloud Run は次の cold start で新しい version を読む。即時反映したい場合は revision update
```

### HTTP プロトコル

公開側の HTTP/2 は Cloud Run フロントエンドが終端し、コンテナへは HTTP/1.1 で渡す構成です (`cloudbuild.yaml` の `--no-use-http2`)。クライアントから見ると HTTP/2 で接続できます。

### Artifact Registry のクリーンアップ

Artifact Registryでは、用途に合わせてcleanup policyを設定してください。例えば:
- タグ無しイメージは 7 日後に自動削除
- タグ付きイメージは最新 10 件を保持

## Cloudflare Workers へのデプロイ

Cloudflare Workersでは、Cloud RunのNode serverと共通のHono appをWorker
`worksmobile-message-bot`から配信する。`nodejs_compat`は`wrangler.jsonc`で明示している。

GitHub Actions 経由でのデプロイ時は、Repository Variable `OAUTH_SCOPE` (`${{ vars.OAUTH_SCOPE }}`) を設定するとビルド時に `wrangler.production.json` の `vars.OAUTH_SCOPE` へ動的注入されます (未設定時は `bot` デフォルト)。

機密値は `wrangler secret put` で設定し、`OAUTH_SCOPE` は GitHub Actions Repository Variable または `wrangler.production.json` の `vars` で設定します。手動時は `wrangler deploy --var OAUTH_SCOPE:bot.message` を使用します。

```sh
bunx wrangler secret put CLIENT_ID
bunx wrangler secret put CLIENT_SECRET
bunx wrangler secret put SERVICE_ACCOUNT
bunx wrangler secret put PRIVATE_KEY
bunx wrangler secret put BOT_ID
bunx wrangler secret put BASIC_ID
bunx wrangler secret put BASIC_PASS
bunx wrangler secret put BOT_SECRET
bunx wrangler secret put FORWARD_CALLBACK_URL
```

`PRIVATE_KEY` は既存の Base64 文字列のまま保存する。`FORWARD_CALLBACK_URL` は必要な場合のみ登録する。

```sh
# bundle 生成まで。外部へ deploy しない
bunx wrangler deploy --dry-run

# deploy（Custom Domainを使わない場合）
bunx wrangler deploy

# 直前の安定版へ rollback。特定版へ戻す場合は version ID を引数にする
bunx wrangler rollback
bunx wrangler rollback "$VERSION_ID"
```

本番 deploy と rollback は、対象 version と callback 疎通手順を確認してから実行する。

### Custom Domain

GitHub ActionsからCustom Domainへdeployする場合は、Repository Variable
`WORKER_CUSTOM_DOMAIN`にhostnameを登録する。workflowは公開用の一時Wrangler configを生成し、
`wrangler.jsonc`自体には環境固有のhostnameを保持しない。手動deployでは同等の`routes`設定を
ローカルの一時configへ追加する。
既存のDNS recordと競合する場合は、切替前に移行元・移行先のhealth checkとrollback手順を
用意したうえでDNSを更新する。切替後はTLS、`/healthz`、認証付きroute、Callbackを確認する。

### 観測

- Workersへデプロイした場合のlive logは`bunx wrangler tail worksmobile-message-bot`で確認する。
- 各log entryには`severity`（`INFO` / `ERROR`等）が付く。
- Cloud Runへデプロイした場合はCloud Loggingで確認する。`x-cloud-trace-context`ヘッダがあれば
  `logging.googleapis.com/trace`フィールドが付き、Traceタブで1 requestのlogをグループ化できる。
- `scripts/setup-monitoring.sh`は実行基盤に依存しないHTTPS uptime監視だけを設定する。
  事前に作成したCloud Monitoring Notification Channelのresource nameを
  `NOTIFICATION_CHANNEL_ID`で渡す。
- Cloud Run固有のログベース指標と通知が必要な場合だけ、
  `scripts/setup-cloud-run-log-monitoring.sh`を追加で実行する。

---

## 使用方法

### 1. エンドポイント一覧

> 認証: `/` と health probe 系パス (`/healthz` / `/health` / `/readyz` / `/livez`) + `/callback` を除く全エンドポイントに **BASIC 認証**を要求する (`hono/basic-auth` を `src/app.ts` で `app.use('*', ...)` 経由でマウント)。credentials は `BASIC_ID` / `BASIC_PASS` env で注入し、本番では Secret Manager (`lineworks-basic-id` / `lineworks-basic-pass`) からマウントする。health probe 系は Cloud Run / k8s / Docker HEALTHCHECK 用に認証なしで公開しており、いずれも 200 OK + `{ status: "ok" }` を返す。`/healthz` を正、それ以外は互換用エイリアス。`/callback` は LINE WORKS が BASIC 認証を喋らないため除外し、代わりに `X-WORKS-Signature` の HMAC 検証で真正性を担保する (詳細は本ファイル末尾「Callback (受信側)」)。

#### [トークルーム指定](https://developers.worksmobile.com/jp/docs/bot-channel-message-send)

- BASE URL: `/channels/{:channelId}`

| Endpoint                         | HTTP | 説明                                                                                                  |
| -------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `/messages/type/text`            | POST | [テキストメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-text)を送信                  |
| `/messages/type/sticker`         | POST | [スタンプメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-sticker)を送信               |
| `/messages/type/image`           | POST | [画像メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-image)を送信                     |
| `/messages/type/file`            | POST | [ファイルメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-file)を送信                  |
| `/messages/type/audio`           | POST | [音声メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-audio)を送信                     |
| `/messages/type/video`           | POST | [動画メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-video)を送信                     |
| `/messages/type/location`        | POST | [位置情報メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-location)を送信              |
| `/messages/type/link`            | POST | [リンクメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-link)を送信                    |
| `/messages/type/button_template` | POST | [ボタンテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-button)を送信                |
| `/messages/type/list_template`   | POST | [リストテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-list)を送信                  |
| `/messages/type/carousel`        | POST | [カルーセルテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-carousel)を送信          |
| `/messages/type/image_carousel`  | POST | [画像カルーセルテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-imagecarousel)を送信 |
| `/messages/type/flex`            | POST | [フレキシブルステンプレート](https://developers.worksmobile.com/jp/docs/bot-send-flex)を送信          |

---

#### [ユーザ指定](https://developers.worksmobile.com/jp/docs/bot-user-message-send)

- BASE URL: `/users/{userId}`

| Endpoint                         | HTTP | 説明                                                                                                  |
| -------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `/messages/type/text`            | POST | [テキストメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-text)を送信                  |
| `/messages/type/sticker`         | POST | [スタンプメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-sticker)を送信               |
| `/messages/type/image`           | POST | [画像メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-image)を送信                     |
| `/messages/type/file`            | POST | [ファイルメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-file)を送信                  |
| `/messages/type/audio`           | POST | [音声メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-audio)を送信                     |
| `/messages/type/video`           | POST | [動画メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-video)を送信                     |
| `/messages/type/location`        | POST | [位置情報メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-location)を送信              |
| `/messages/type/link`            | POST | [リンクメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-link)を送信                    |
| `/messages/type/button_template` | POST | [ボタンテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-button)を送信                |
| `/messages/type/list_template`   | POST | [リストテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-list)を送信                  |
| `/messages/type/carousel`        | POST | [カルーセルテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-carousel)を送信          |
| `/messages/type/image_carousel`  | POST | [画像カルーセルテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-imagecarousel)を送信 |
| `/messages/type/flex`            | POST | [フレキシブルテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-flex)を送信            |

---

#### [コンテンツ](https://developers.worksmobile.com/jp/docs/bot-attachment-create)

- BASE URL: `/attachments`

| Endpoint             | HTTP | 説明                                                                                    |
| -------------------- | ---- | --------------------------------------------------------------------------------------- |
| `/`        | POST | [コンテンツアップロード](https://developers.worksmobile.com/jp/docs/file-upload)        |
| `/{:fileId}` | GET | [コンテンツダウンロード](https://developers.worksmobile.com/jp/docs/bot-attachment-get) |

---

#### [固定メニュー](https://developers.worksmobile.com/jp/reference/bot-persistentmenu-create) (持続表示メニュー)

- BASE URL: `/menus/persistent`
- Bot とのトーク画面でチャット入力欄上部に常時表示されるボタン群 (最大 4 件) を管理

| Endpoint | HTTP   | 説明                                                                                                   |
| -------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `/`      | POST   | [固定メニューを登録](https://developers.worksmobile.com/jp/reference/bot-persistentmenu-create) (上書き) → 201 + メニュー JSON |
| `/`      | GET    | 固定メニューを取得 (未登録時は 200 + `null`)                                                            |
| `/`      | DELETE | 固定メニューを削除 (未登録時も 204 で idempotent)                                                       |

---

#### [リッチメニュー](https://developers.worksmobile.com/jp/reference/bot-richmenu-create) (画像ベースの大型メニュー)

- BASE URL: `/menus/rich`
- 画像 1 枚を分割して領域ごとにアクションを割り当てる、UX 向け大型メニュー (全 12 endpoint)

| Endpoint | HTTP | 説明 |
| --- | --- | --- |
| `/` | POST | リッチメニューを作成 → 201 + `{ richmenuId }` |
| `/` | GET | 登録済リッチメニュー一覧 → 200 + `{ richmenus: [...] }` |
| `/default` | GET | デフォルトリッチメニュー ID を取得 → 200 + `{ botId, defaultRichmenuId }` |
| `/default` | DELETE | デフォルトリッチメニューの設定を解除 → 204 No Content |
| `/users/{:userId}` | GET | 特定ユーザーに適用されているリッチメニュー詳細を取得 → 200 + RichMenu |
| `/users/{:userId}` | DELETE | 特定ユーザーのリッチメニュー適用を解除 → 204 No Content |
| `/{:richmenuId}` | GET | リッチメニュー詳細を取得 → 200 + RichMenu |
| `/{:richmenuId}` | DELETE | リッチメニューを削除 (未登録時も 204 で idempotent) |
| `/{:richmenuId}/image` | GET | リッチメニュー画像情報 (fileId, i18nFileIds) を取得 → 200 + `{ fileId, i18nFileIds? }` |
| `/{:richmenuId}/image` | POST | 事前アップロード済み `fileId` を JSON で画像登録 → 204 No Content |
| `/{:richmenuId}/set-default` | POST | このリッチメニューを Bot 全員のデフォルトとして適用 → 201 + `{ botId, defaultRichmenuId }` |
| `/{:richmenuId}/users/{:userId}` | POST | 特定ユーザーにこのリッチメニューを適用 → 204 No Content |

> 互換性注意: 公開 route の HTTP ステータスを公式 LINE WORKS API 仕様へ同期した。メッセージ送信 (`POST .../messages/type/*`) は 201 (空 body)、トークルーム作成 (`POST /channels`) は 201 + JSON、固定メニュー登録 (`POST /menus/persistent`) は 201 + JSON、リッチメニュー作成 (`POST /menus/rich`) は 201 + JSON、デフォルトリッチメニュー適用 (`POST /menus/rich/:id/set-default`) は 201 + `{ botId, defaultRichmenuId }` を返す。画像登録は公式 API に合わせ `204 No Content` を返す。

---

#### [チャンネル管理](https://developers.worksmobile.com/jp/reference/bot-channel-create) (トークルーム CRUD)

- BASE URL: `/channels`
- Bot がいるトークルームの作成 / 情報取得 / 退室 / メンバー一覧 (既存の `/channels/:id/messages/type/<type>` とは別経路)

| Endpoint           | HTTP   | 説明                                                                                         |
| ------------------ | ------ | -------------------------------------------------------------------------------------------- |
| `/`                | POST   | [トークルーム作成](https://developers.worksmobile.com/jp/reference/bot-channel-create) → 201 + `{ channelId }` |
| `/{:channelId}`    | GET    | トークルーム情報取得 (`domainId` / `title` / `channelType`)。未登録は 200 + `null`              |
| `/{:channelId}`    | DELETE | Bot をトークルームから退室 (未参加でも 204 で idempotent)                                       |
| `/{:channelId}/members` | GET | メンバー一覧。`?count=1〜100&cursor=...` でページング                                          |

---

#### [ドメインメンバー管理](https://developers.worksmobile.com/jp/reference/bot-domain-member-create) (Bot 利用ユーザー)

- BASE URL: `/domains/{:domainId}`
- ドメイン内で Bot を利用できるユーザーを 1 件ずつ登録 / 一覧取得 / 削除

| Endpoint            | HTTP   | 説明                                                                                          |
| ------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `/members`          | POST   | Bot 利用ユーザーを 1 件登録 (`{ userId }`) → 201 + `{ userId }`                                  |
| `/members`          | GET    | 利用ユーザー一覧。`?count=1〜100&cursor=...` でページング                                       |
| `/members/{:userId}` | DELETE | Bot 利用ユーザーを削除 (未登録でも 204 で idempotent)                                          |

> API 経由の登録 / 削除はユーザーへのサービス通知を送りません (管理画面経由とは挙動が異なる)。同一 Bot に対する操作 API は並列で叩かないこと。

---

#### [Bot CRUD (テナント)](https://developers.worksmobile.com/jp/reference/bot-create) (Bot 自体の作成・更新・削除)

- BASE URL: `/bots`
- LINE WORKS テナント上の Bot を programmable に管理。**Developer Console で手動操作する代替手段**として用意

| Endpoint              | HTTP   | 説明                                                                                                |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `/`                   | POST   | Bot を新規作成 → 201 + `{ botId, ... }`                                                              |
| `/`                   | GET    | テナント内 Bot 一覧 → 200 + `{ bots: [...] }`                                                        |
| `/{:botId}`           | GET    | Bot 取得 (未登録は 200 + `null`)                                                                     |
| `/{:botId}`           | PUT    | Bot 完全置換 (全フィールド再送)                                                                      |
| `/{:botId}`           | PATCH  | Bot 部分更新 (送ったフィールドだけ)                                                                  |
| `/{:botId}`           | DELETE | **破壊的** Bot 削除 (404 idempotent、復元不可)                                                       |
| `/{:botId}/secret`    | POST   | **破壊的** Bot Secret 再発行 → 200 + `{ botSecret }`。発行後は Secret Manager の `lineworks-bot-secret` を更新しないと Callback 署名検証が失敗 |

> 本番運用中の `BOT_ID` (env と一致) に対する `DELETE` と `POST /secret` は、**`?confirm=<botId>` クエリを付けないと 403 で拒否**されます。誤操作で本番 Bot を消失させないための物理ガード。意図的に実行する場合は `curl -X DELETE -u "$U:$P" "https://.../bots/<botId>?confirm=<botId>"` のように confirm を付ける。

---

#### [Bot CRUD (ドメイン別)](https://developers.worksmobile.com/jp/reference/bot-domain-bot-update) (ドメイン上の Bot 設定)

- BASE URL: `/bots/{:botId}/domains`
- ドメイン単位の Bot 公開設定 (`visible` / `allowToSelectedMember`) を個別に管理

| Endpoint              | HTTP   | 説明                                                                                          |
| --------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `/`                   | GET    | Bot が登録されているドメイン一覧                                                              |
| `/{:domainId}`        | POST   | ドメインに Bot を登録                                                                          |
| `/{:domainId}`        | PUT    | ドメイン別 Bot 設定を完全置換                                                                  |
| `/{:domainId}`        | PATCH  | ドメイン別 Bot 設定を部分更新                                                                  |
| `/{:domainId}`        | DELETE | Bot をドメインから削除 (404 idempotent)                                                       |

---

### 主要な制約サマリ (LINE WORKS spec 準拠)

各 type のリクエスト本文は Zod schema で起動時にバリデーションされる。仕様より緩いと
LINE WORKS 側で 400 になるため、この表に揃えている:

| 対象 | 制約 |
|---|---|
| `text.text` | 1〜2000 文字 |
| `image` | `previewImageUrl` + `originalContentUrl` を**両方**指定するか、`fileId` 単独。HTTPS 必須 |
| `file.originalContentUrl` | **HTTPS のみ** (http は spec 違反) |
| `audio` | `originalContentUrl` (HTTPS) または `fileId` のどちらか一方 |
| `video` | `previewImageUrl` (HTTPS, **PNG 限定**) + `originalContentUrl` (HTTPS) を両方指定するか、`fileId` 単独 |
| `location` | `title` / `address` (各 1〜100 文字)、`latitude` (-90〜90)、`longitude` (-180〜180) すべて必須 |
| `link.contentText` / `linkText` / `link` | 各最大 1000 文字 |
| `button_template.actions` | 1〜10 件、各 `label` は最大 20 文字 |
| `list_template.elements` | 1〜**4** 件 |
| `carousel.columns` | 1〜10 件、各 `actions` は 1〜3 件、**全 column で actions 件数を揃える** |
| `carousel.imageAspectRatio` | `"rectangle"` / `"square"` のみ (default `rectangle`) |
| `carousel.imageSize` | `"cover"` / `"contain"` のみ (default `cover`) |
| `image_carousel.columns[].action.label` | 最大 **12** 文字 |
| `flex.altText` | 最大 400 文字 |
| `quickReply.items` | 1〜13 件 |
| `postback` action | `data` (1〜300 文字) **必須** |
| `uri` action | `uri` は HTTP / HTTPS、最大 1000 文字 |
| `copy` action | `copyText` は 1〜1000 文字 |
| 添付ファイル upload | 最大 10 MB |
| 固定メニュー `actions` | 0〜**4** 件、`label` 最大 1000 文字、`message.text` 最大 300 文字 |
| リッチメニュー `size` | `width=2500` 固定、`height` は `843` (compact) または `1686` (full) のみ |
| リッチメニュー `richmenuName` | 1〜300 文字 |
| リッチメニュー `areas[].action.label` | 最大 **20** 文字 (固定メニューより短い) |
| リッチメニュー画像 | JPEG / PNG、2500x843 または 2500x1686、最大 **1 MB** |
| トークルーム作成 `members` | 1〜100 件、重複不可 |
| トークルーム作成 `title` | 最大 1000 文字 |
| `channels/:id/members` `?count` | 1〜100 (デフォルト 50)、`cursor` でページング |
| `domains/:domainId/members` `?count` | 1〜100 (デフォルト 50)、`cursor` でページング |
| Bot `botName` / `description` | 各 1〜100 文字 |
| Bot `photoUrl` / `callbackUrl` | **HTTPS のみ**、最大 1000 文字 |
| Bot `administrators` | 1〜3 件、重複不可 |
| Bot `subadministrators` | 0〜3 件 |
| Bot `callbackEvents` | `text`/`location`/`sticker`/`image`/`file`/`audio`/`video` から選択 |
| Bot `channelEvents` | `message`/`join`/`leave`/`joined`/`left`/`postback`/`begin`/`end` から選択 |

---

### 2. リクエスト例

#### テキストメッセージ を送信

- Endpoint: `/channels/{:channelId}/messages/type/text`
- HTTP: `POST`
- Body:
  ```json
  {
    "text": "こんにちは！"
  }
  ```

---

#### 画像メッセージ を送信

- Endpoint: `/channels/{:channelId}/messages/type/image`
- HTTP: `POST`
- Body:
  ```json
  {
    "originalContentUrl": "https://example.com/image.png",
    "previewImageUrl": "https://example.com/preview.png"
  }
  ```

---

#### ファイルメッセージ を送信

- Endpoint: `/channels/{:channelId}/messages/type/file`
- HTTP: `POST`
- Content-Type: `application/json`
- Body:
  ```json
  {
    "originalContentUrl": "https://example.com/file.pdf"
  }
  ```

---

#### 音声メッセージ を送信

- Endpoint: `/channels/{:channelId}/messages/type/audio`
- HTTP: `POST`
- Body:
  ```json
  {
    "originalContentUrl": "https://example.com/audio.mp3"
  }
  ```
  > `originalContentUrl` は HTTPS のみ。`fileId` 単独でも可。

---

#### 動画メッセージ を送信

- Endpoint: `/channels/{:channelId}/messages/type/video`
- HTTP: `POST`
- Body:
  ```json
  {
    "previewImageUrl": "https://example.com/preview.png",
    "originalContentUrl": "https://example.com/video.mp4"
  }
  ```
  > `previewImageUrl` は **PNG 限定**。両方セット指定が必須 (`fileId` 単独でも可)。

---

#### 位置情報メッセージ を送信

- Endpoint: `/channels/{:channelId}/messages/type/location`
- HTTP: `POST`
- Body:
  ```json
  {
    "title": "本社",
    "address": "東京都千代田区紀尾井町 1-3",
    "latitude": 35.67966,
    "longitude": 139.73669
  }
  ```

---

#### ボタンテンプレート を送信

- Endpoint: `/channels/{:channelId}/messages/type/button_template`
- HTTP: `POST`
- Content-Type: `application/json`
- Body:
  ```json
  {
    "contentText": "ボタンを選択してください",
    "actions": [
      {
        "type": "uri",
        "label": "リンク1",
        "uri": "https://example.com"
      },
      {
        "type": "postback",
        "label": "アクション",
        "data": "action=buy&itemid=123"
      }
    ]
  }
  ```

---

#### カルーセルテンプレート を送信

- Endpoint: `/channels/{:channelId}/messages/type/carousel`
- HTTP: `POST`
- Content-Type: `application/json`
- Body:
  ```json
  {
    "columns": [
      {
        "originalContentUrl": "https://example.com/img1.png",
        "title": "タイトル1",
        "text": "詳細1",
        "actions": [
          {
            "type": "uri",
            "label": "リンク1",
            "uri": "https://example.com/1"
          }
        ]
      },
      {
        "originalContentUrl": "https://example.com/img2.png",
        "title": "タイトル2",
        "text": "詳細2",
        "actions": [
          {
            "type": "uri",
            "label": "リンク2",
            "uri": "https://example.com/2"
          }
        ]
      }
    ]
  }
  ```
  > 全カラムで `actions` の件数を揃える必要がある (LINE WORKS spec)。

---

#### クイックリプライ を使って テキストメッセージ 送信

- Endpoint: `/channels/{:channelId}/messages/type/text`
- HTTP: `POST`
- Content-Type: `application/json`
- Body:
  ```json
  {
    "text": "選択肢から選んでください。",
    "quickReply": {
      "items": [
        {
          "action": {
            "type": "message",
            "label": "オプション1",
            "text": "選択肢1が選ばれました"
          }
        },
        {
          "action": {
            "type": "postback",
            "label": "購入",
            "data": "action=buy&itemid=123",
            "displayText": "購入を選びました"
          }
        },
        {
          "action": {
            "type": "uri",
            "label": "詳細を見る",
            "uri": "https://example.com"
          }
        }
      ]
    }
  }
  ```
  > postback action は **`data`** が必須 (旧 `postback` フィールドは spec 外)。

---

#### コンテンツアップロード を使ってファイルをアップロード

- Endpoint: `/attachments`
- HTTP: `POST`
- Body:
  ```md
    multipart/form-data
    Key: file
    Value: <file>
  ```
- Response:
  ```json
  {
    "fileId": "fileId"
  }
  ```

---
#### コンテンツダウンロード を使ってファイルをダウンロード

- Endpoint: `/attachments/{:fileId}`
- HTTP: `GET`
- Response: ファイルストリーム

---

#### 固定メニュー を登録

- Endpoint: `/menus/persistent`
- HTTP: `POST`
- Body:
  ```json
  {
    "content": {
      "actions": [
        { "type": "message", "label": "本日の予定", "text": "/today" },
        { "type": "message", "label": "ヘルプ", "text": "/help" },
        { "type": "uri", "label": "ダッシュボード", "uri": "https://example.com/dashboard" }
      ]
    }
  }
  ```
  > `actions` は最大 4 件。`label` 最大 1000 文字、`message.text` 最大 300 文字。

#### 固定メニュー を取得 / 削除

- 取得: `GET /menus/persistent` → 200 + メニュー JSON (未登録時は `null`)
- 削除: `DELETE /menus/persistent` → 204 (未登録も idempotent)

---

#### リッチメニュー を作成して画像登録 → デフォルト適用

リッチメニューは「作成 → 画像登録 → デフォルト適用」の 3 ステップ。

##### 1. 作成

- Endpoint: `/menus/rich`
- HTTP: `POST`
- Body (compact size 例):
  ```json
  {
    "richmenuName": "SUMIRE 業務メニュー v1",
    "size": { "width": 2500, "height": 843 },
    "areas": [
      {
        "bounds": { "x": 0, "y": 0, "width": 1250, "height": 843 },
        "action": { "type": "postback", "label": "本日の予定", "data": "action=today" }
      },
      {
        "bounds": { "x": 1250, "y": 0, "width": 1250, "height": 843 },
        "action": { "type": "postback", "label": "送迎開始", "data": "action=pickup_start" }
      }
    ]
  }
  ```
- Response: 201 Created
  ```json
  { "richmenuId": "rm-001-xxx" }
  ```

##### 2. 画像をコンテンツアップロードして fileId を取得

まず [コンテンツアップロード](https://developers.worksmobile.com/jp/docs/bot-attachment-create) で画像の `uploadUrl` を取得し、画像をアップロードする。アップロード結果の `fileId` を次の画像登録で使う。

##### 3. 画像登録

- Endpoint: `/menus/rich/{:richmenuId}/image`
- HTTP: `POST`
- Body:
  ```json
  {
    "fileId": "file-001",
    "i18nFileIds": [{ "language": "en_US", "fileId": "file-en-001" }]
  }
  ```
- Response: `204 No Content`

##### 4. デフォルトとして適用

- Endpoint: `/menus/rich/{:richmenuId}/set-default`
- HTTP: `POST`
- Body: なし (URL の `:richmenuId` だけで完結)
- Response: 201 Created
  ```json
  { "botId": 12345, "defaultRichmenuId": "rm-001-xxx" }
  ```

##### 5. 詳細・画像情報取得 / ユーザー設定 / デフォルト取得・解除 / 削除

- 詳細取得: `GET /menus/rich/{:richmenuId}` → 200 + RichMenu
- 画像情報取得: `GET /menus/rich/{:richmenuId}/image` → 200 + `{ fileId, i18nFileIds? }`
- 一覧取得: `GET /menus/rich?count={1..100}&cursor={str}` → 200 + `{ richmenus: [...], responseMetaData?: { nextCursor } }`
- ユーザー個別設定: `POST /menus/rich/{:richmenuId}/users/{:userId}` → 204 No Content
- ユーザー設定取得: `GET /menus/rich/users/{:userId}` → 200 + RichMenu
- ユーザー設定解除: `DELETE /menus/rich/users/{:userId}` → 204 No Content
- デフォルト取得: `GET /menus/rich/default` → 200 + `{ botId, defaultRichmenuId }`
- デフォルト解除: `DELETE /menus/rich/default` → 204 No Content
- 削除: `DELETE /menus/rich/{:richmenuId}` → 204 (未登録も idempotent)

---

#### チャンネル管理 (Bot 退室 / メンバー一覧)

##### 作成

- Endpoint: `/channels`
- HTTP: `POST`
- Body:
  ```json
  {
    "members": ["userId-1", "userId-2"],
    "title": "業務連絡 (任意, 最大 1000 文字)"
  }
  ```
- Response: 201 Created `{ "channelId": "ch-001", "title": "業務連絡" }`

##### 情報取得 / 退室 / メンバー一覧

- 情報: `GET /channels/{:channelId}` → 200 + `{ domainId, channelId, title, channelType }` (未登録は `null`)
- 退室: `DELETE /channels/{:channelId}` → 204 (Bot がそのトークルームから退室。未参加でも idempotent)
- メンバー: `GET /channels/{:channelId}/members?count=50&cursor=...` → 200 + `{ members: [...], responseMetaData: { nextCursor? } }`

---

#### ドメインメンバー管理 (Bot 利用ユーザー)

##### 登録

- Endpoint: `/domains/{:domainId}/members`
- HTTP: `POST`
- Body:
  ```json
  { "userId": "u1-or-login-id@example.com" }
  ```
- Response: `201 + { "userId": "u1-or-login-id@example.com" }`

##### 一覧 / 削除

- 一覧: `GET /domains/{:domainId}/members?count=50&cursor=...` → 200 + `{ members: [...], responseMetaData: { nextCursor? } }`
- 削除: `DELETE /domains/{:domainId}/members/{:userId}` → 204 (未登録でも idempotent)

---

#### Bot CRUD (テナント)

##### 作成

- Endpoint: `/bots`
- HTTP: `POST`
- Body (必須 4 + 任意):
  ```json
  {
    "botName": "SUMIRE Group",
    "photoUrl": "https://example.com/photo.png",
    "description": "職員通知 Bot",
    "administrators": ["admin-user-id"],
    "enableCallback": true,
    "callbackUrl": "https://bot.example.com/callback",
    "callbackEvents": ["text", "image", "file"],
    "channelEvents": ["message", "join", "leave", "joined", "left", "postback", "begin", "end"],
    "enableGroupJoin": true
  }
  ```
- Response: `201 + { "botId": "b-001", ...input }`

##### 取得 / 一覧 / 更新 / 削除 / Secret 再発行

- 一覧: `GET /bots?count={1..100}&cursor={str}` → 200 + `{ bots: [...], responseMetaData?: { nextCursor } }`
- 取得: `GET /bots/{:botId}` → 200 + BotInfo (未登録は `null`)
- 完全置換: `PUT /bots/{:botId}` (作成と同じ body 構造)
- 部分更新: `PATCH /bots/{:botId}` (`{ "botName": "Renamed" }` 等の部分 body)
- 削除: `DELETE /bots/{:botId}` → 204 (**破壊的・復元不可・本番 BOT_ID へは警告ログ**)
- Secret 再発行: `POST /bots/{:botId}/secret` → 200 + `{ botSecret }` (**破壊的・Secret Manager 更新必須**)

> ⚠️ Bot 削除と Secret 再発行は LINE WORKS 上の Bot を直接書き換える破壊的操作です。本番運用中 Bot に対しては、必ず影響範囲を確認してから実行してください。Secret 再発行後は以下を実行する必要があります:
> ```sh
> echo -n "$NEW_SECRET" | gcloud secrets versions add lineworks-bot-secret --data-file=-
> ```

---

#### Bot CRUD (ドメイン別)

ドメイン上の Bot の公開範囲と利用メンバー制限をドメイン単位で個別管理。テナント Bot CRUD と区別。

- 登録: `POST /bots/{:botId}/domains/{:domainId}` (body: `{ visible?: bool, allowToSelectedMember?: bool }`) → 201 + `{ botId, domainId }`
- 一覧: `GET /bots/{:botId}/domains?count={1..100}&cursor={str}` → 200 + `{ domains: [...], responseMetaData?: { nextCursor } }`
- 完全置換: `PUT /bots/{:botId}/domains/{:domainId}`
- 部分更新: `PATCH /bots/{:botId}/domains/{:domainId}` (送ったフィールドだけ)
- 削除: `DELETE /bots/{:botId}/domains/{:domainId}` → 204 (404 idempotent)

***

## Callback (受信側)

LINE WORKS から Bot 宛のイベント (メッセージ送信 / ボタン押下 / トーク参加・退室 等) を受け取って自動応答するエンドポイント。

### エンドポイント

| Endpoint    | HTTP | 説明                                                                                          |
| ----------- | ---- | --------------------------------------------------------------------------------------------- |
| `/callback` | POST | LINE WORKS からの [Bot Callback](https://developers.worksmobile.com/jp/docs/bot-callback) を受信 |

#### 認証

- BASIC 認証は適用しない (LINE WORKS は BASIC 認証ヘッダを付けないため)
- 代わりに **`X-WORKS-Signature` ヘッダ (= raw body の HMAC-SHA256 を Bot Secret を鍵に計算し Base64 化した値) を検証**して真正性を担保する
- 検証 NG → `401 invalid signature` を返す。LINE WORKS は再送しないため body は短くしている
- 検証 OK → dedup チェック (下記) → JSON.parse → Zod の `discriminatedUnion` でevent形式を確認 → 転送先が設定されていればraw bodyと署名をupstream serviceへ転送 → `200`を返す

#### Dedup (5 分 window)

LINE WORKS が同一 event を再送した場合に副作用が二重実行されるのを防ぐため、`src/services/lineworks/callback/dedup.ts` で軽量 dedup を実施する。

- **Dedup key**: raw body の SHA-256 hex (`createHash('sha256').update(rawBody).digest('hex')`)。LINE WORKS の callback payload には event ID 相当のフィールドが無いため、payload 全体のハッシュをキーにする
- **TTL**: 5 分。同じ key が直近 5 分以内に届いていれば skip して 200 を返す (LINE WORKS の再送を黙らせる)
- **失敗時 retry**: upstreamへの転送が5xxまたはnetwork errorで失敗した場合はdedup keyを`unregister`し、LINE WORKSからの再送を許可する
- **検証順序**: 署名検証 → dedup → JSON parse → Zod検証 → 設定済みupstreamへ転送

⚠️ **Workersのisolate間、およびCloud Runのinstance間でwmbot内のMapは共有されない**ため、
callback dedupはどちらの基盤でもbest effortです。厳密な一回処理が必要な場合は、
共有永続ストアまたは転送先でのidempotencyを実装してください。

#### 受信できる event 種別

`discriminatedUnion('type', [...])` で 8 種を網羅:

| type       | 発火タイミング                                              |
| ---------- | ----------------------------------------------------------- |
| `message`  | メンバーが Bot にメッセージを送った (text / image / etc.)  |
| `postback` | ボタンテンプレート等の postback action が押された           |
| `join`     | Bot が複数人トークに招待された                              |
| `leave`    | Bot が複数人トークから退出した                              |
| `joined`   | Bot が属するトークルームに新メンバーが参加した              |
| `left`     | Bot が属するトークルームからメンバーが退出した              |
| `begin`    | 1:1 トーク開始 (メンバーが Bot との 1:1 トークを開いた)     |
| `end`      | 1:1 トーク終了                                              |

未知 type は 400 を返す (Zod 検証で reject)。仕様変更で新 type が増えた場合は `schemas.ts` の union に追加。

### Callback転送

`FORWARD_CALLBACK_URL`を設定すると、検証済みCallbackを任意のupstream serviceへ転送する。
未設定の場合は転送せず、署名・payload検証とdedupだけを行って`200`を返す。

### 初回セットアップ手順 (Developer Console)

1. [Developer Console](https://developers.worksmobile.com/jp/console/) → **Bot** → 該当 Bot → 編集
2. **Bot Secret**をコピーし、利用する基盤へ`BOT_SECRET`として登録する
   - Workers: `bunx wrangler secret put BOT_SECRET`
   - Cloud Run: Secret Managerの`lineworks-bot-secret`
3. 利用する基盤へのdeploy済み状態を確認する（Workersはbinding、Cloud RunはSecret Managerのマウントを確認する）
4. Bot 編集画面の **Callback URL** を `On` にして:
   - URL: `https://<your-domain>/callback`（例: `https://bot.example.com/callback`）
   - 受信する Callback Event を必要なものだけ ON (`Message Event` / `Postback Event` / `Join` / `Leave` / `Joined` / `Left` / `Begin` / `End`)
5. Bot ポリシーで「1:1 トーク」「複数人トーク」を許可 (受信するイベントに応じて)
6. **保存** → LINE WORKS の自分宛 Bot にメッセージ `/help` を送って、ヘルプ文が返信されることを確認

> ⚠️ Callback URLをOnにする前に、選択したデプロイ先で`/callback`が応答することを確認してください。デプロイ前にOnにするとCallbackが404となり、イベントを失う可能性があります。

***

## ライセンス

MIT ライセンスの下で公開されています。
