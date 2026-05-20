# Webhook Bot Messenger for LINE WORKS

![Bun](https://img.shields.io/badge/-Bun-000000.svg?logo=bun&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6.svg?logo=typescript&logoColor=white&style=flat-square)
![Hono](https://img.shields.io/badge/-Hono-E36002.svg?logo=hono&logoColor=white&style=flat-square)
![Biome](https://img.shields.io/badge/-Biome-60A5FA.svg?logo=biome&logoColor=white&style=flat-square)
![LINE WORKS](https://img.shields.io/badge/-LINE_WORKS-00C300.svg?logo=line&logoColor=white&style=flat-square)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)

社内で [LINE WORKS API](https://developers.worksmobile.com/jp/docs/api) を利用して各種メッセージ (テキスト、画像、ファイル、カルーセルなど) を Bot から送信するための Webhook サーバー。[IFTTT](https://ifttt.com/) や [Make](https://www.make.com/) などのノーコードツールから Webhook 経由で手軽に LINE WORKS Bot を叩くために作成。

### 技術スタック

- **ランタイム**: [Bun](https://bun.sh/) 1.3.x
- **言語**: TypeScript (ESM, strict)
- **HTTP フレームワーク**: [Hono](https://hono.dev/) + [@hono/node-server](https://github.com/honojs/node-server)
- **検証**: [Zod](https://zod.dev/) + [@hono/zod-validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator)
- **Linter / Formatter**: [Biome](https://biomejs.dev/) 2.x
- **Logger**: [pino](https://github.com/pinojs/pino) (+ pino-pretty in dev) — Cloud Logging severity / trace 連携付き
- **pre-commit**: [lefthook](https://github.com/evilmartians/lefthook)
- **CI**: GitHub Actions (PR で `tsc --noEmit` + `biome check`)
- **CD**: Cloud Build (`cloudbuild.yaml`) → Cloud Run (asia-northeast1)

### 参考にさせていただいた記事

- [チュートリアル - 応答 Bot を作る | LINE Developers](https://developers.line.biz/ja/docs/messaging-api/nodejs-sample/)
- [Make で LINE WORKS API を実行してみる (OAuth2.0) #LINEWORKS - Qiita](https://qiita.com/mmclsntr/items/98922edd6046d4294a23)
- [【Node.js × LINE WORKS API】API で BOT を登録する #初心者向け - Qiita](https://qiita.com/kunihiros/items/33e6ddf11ba9b08835d9)

---

## 環境変数の設定

`.env` を作成して以下を設定。

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
| `FORWARD_501_CALLBACK_URL` | (任意) 受信 callback の転送先 = 501 (scheduler-501) の `/callback` URL。未設定なら転送せず素通し |
| `PORT` | listen ポート (省略時 `8080`) |
| `NODE_ENV` | `production` でログレベルを `error` 以上に絞る |
| `LOG_PRETTY` | `1` で pino-pretty 経由のカラー出力 (development のみ有効) |
| `GOOGLE_CLOUD_PROJECT` | Cloud Run 上で設定すると Cloud Logging trace 連携が fully-qualified resource name 形式 (`projects/<id>/traces/<traceId>`) で出る (`cloudbuild.yaml` のデプロイ step で自動注入される) |

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
| Lint / format (auto-fix) | `bunx biome check --write ./src` |
| 本番ビルド (`build/index.js` を出力) | `bun run build` |
| 本番ビルドを起動 | `bun run start` |
| Docker イメージビルド | `bun run docker:build` |
| pre-commit hook 有効化 | `bun run lefthook:install` |

`pre-commit` で biome auto-fix と `tsc --noEmit` が走るため、手動で先回り実行する必要は無い。

---

## デプロイ (Cloud Run)

GitHub `main` への push を Cloud Build trigger が拾い、`cloudbuild.yaml` のパイプライン (build → push → deploy) を実行する設計です。

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

# 4. 機密度の低い env は Cloud Build trigger の substitution variable に設定
#    (公開リポに値を残さないため。GCP Console: Cloud Build → Triggers → 該当 trigger 編集 →
#    "Substitution variables" セクションに以下を追加)
#      _CLIENT_ID            = LINE WORKS の client ID
#      _SERVICE_ACCOUNT_LW   = LINE WORKS の service account (例: lrpkq.serviceaccount@xxx)
#      _BOT_ID               = LINE WORKS の bot ID

# 5. Cloud Build trigger を cloudbuild.yaml ベースへ切替
gcloud builds triggers describe <TRIGGER_NAME> --format=yaml > trigger.yaml
# trigger.yaml の `build:` を削除し `filename: cloudbuild.yaml` を追加
gcloud builds triggers import --source=trigger.yaml
```

### 通常のデプロイ

`main` に push するだけ。Cloud Build が `cloudbuild.yaml` の通り走ります:
1. Docker build → Artifact Registry へ push (タグ: `$SHORT_SHA`)
2. `gcloud run services update` で SA / secrets / scaling / resources を一括適用

### Secret のローテーション

Cloud Run は `:latest` を参照しているので、**再デプロイ無し**で値だけ更新可能:
```sh
echo -n "$NEW_VALUE" | gcloud secrets versions add lineworks-client-secret --data-file=-
# Cloud Run は次の cold start で新しい version を読む。即時反映したい場合は revision update
```

### HTTP プロトコル

公開側の HTTP/2 は Cloud Run フロントエンドが終端し、コンテナへは HTTP/1.1 で渡す構成です (`cloudbuild.yaml` の `--no-use-http2`)。クライアントから見ると HTTP/2 で接続できます。

### Artifact Registry のクリーンアップ

`cloud-run-source-deploy` リポジトリには cleanup policy 設定済:
- タグ無しイメージは 7 日後に自動削除
- タグ付きイメージは最新 10 件を保持

### 観測 (Cloud Logging)

- 各 log エントリには `severity` (`INFO`/`ERROR` 等) が付与され、Console の severity フィルタで絞れる
- `x-cloud-trace-context` ヘッダがあれば `logging.googleapis.com/trace` フィールドが自動で乗り、Trace タブで 1 リクエストの全ログがグループ化される

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
| `/`      | POST   | [固定メニューを登録](https://developers.worksmobile.com/jp/reference/bot-persistentmenu-create) (上書き) |
| `/`      | GET    | 固定メニューを取得 (未登録時は 200 + `null`)                                                            |
| `/`      | DELETE | 固定メニューを削除 (未登録時も 204 で idempotent)                                                       |

---

#### [リッチメニュー](https://developers.worksmobile.com/jp/reference/bot-richmenu-create) (画像ベースの大型メニュー)

- BASE URL: `/menus/rich`
- 画像 1 枚を分割して領域ごとにアクションを割り当てる、UX 向け大型メニュー (MVP は 5 endpoint)

| Endpoint                | HTTP   | 説明                                                                                            |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `/`                     | POST   | リッチメニューを作成 → 200 + `{ richmenuId }`                                                    |
| `/`                     | GET    | 登録済リッチメニュー一覧 → 200 + `{ richmenus: [...] }`                                          |
| `/{:richmenuId}/image`  | POST   | 画像を登録 (`multipart/form-data`, `file` フィールドに JPEG / PNG, 1MB 以下)                    |
| `/{:richmenuId}/set-default` | POST   | このリッチメニューを Bot 全員のデフォルトとして適用 → 200 + `{ richmenuId }`              |
| `/{:richmenuId}`        | DELETE | リッチメニューを削除 (未登録時も 204 で idempotent)                                              |

---

#### [チャンネル管理](https://developers.worksmobile.com/jp/reference/bot-channel-create) (トークルーム CRUD)

- BASE URL: `/channels`
- Bot がいるトークルームの作成 / 情報取得 / 退室 / メンバー一覧 (既存の `/channels/:id/messages/type/<type>` とは別経路)

| Endpoint           | HTTP   | 説明                                                                                         |
| ------------------ | ------ | -------------------------------------------------------------------------------------------- |
| `/`                | POST   | [トークルーム作成](https://developers.worksmobile.com/jp/reference/bot-channel-create) → `{ channelId }` |
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
- ドメイン単位の Bot 設定 (administrators / enableCallback 等) を個別に管理

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
| Bot `channelEvents` | `join`/`leave`/`joined`/`left`/`begin`/`end` から選択 |

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
- Response:
  ```json
  { "richmenuId": "rm-001-xxx" }
  ```

##### 2. 画像登録

- Endpoint: `/menus/rich/{:richmenuId}/image`
- HTTP: `POST`
- Body:
  ```md
    multipart/form-data
    Key: file
    Value: <2500x843 or 2500x1686 の JPEG/PNG, 1MB 以下>
  ```

##### 3. デフォルトとして適用

- Endpoint: `/menus/rich/{:richmenuId}/set-default`
- HTTP: `POST`
- Body: なし (URL の `:richmenuId` だけで完結)

##### 4. 一覧取得 / 削除

- 一覧: `GET /menus/rich` → 200 + `{ richmenus: [...] }`
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
- Response: `{ "channelId": "ch-001", "title": "業務連絡" }`

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
    "callbackUrl": "https://line-works.api.miraius.co.jp/callback",
    "callbackEvents": ["text", "image", "file"],
    "channelEvents": ["join", "leave", "joined", "left", "begin", "end"],
    "enableGroupJoin": true
  }
  ```
- Response: `201 + { "botId": "b-001", ...input }`

##### 取得 / 一覧 / 更新 / 削除 / Secret 再発行

- 一覧: `GET /bots` → 200 + `{ bots: [...] }`
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

ドメイン上の Bot 設定 (administrators / enableCallback 等) をドメイン単位で個別管理。テナント Bot CRUD と区別。

- 登録: `POST /bots/{:botId}/domains/{:domainId}` (body: `{ administrators: ['u1'], enableCallback?: bool, ... }`) → 201 + `{ botId, domainId }`
- 一覧: `GET /bots/{:botId}/domains` → 200 + `{ domains: [...] }`
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
- 検証 OK → dedup チェック (下記) → JSON.parse → Zod の `discriminatedUnion` で event 形式チェック → **501 (scheduler-501) の `/callback` へ raw body + 署名をそのまま転送** → `200` を返す (案 B)

#### Dedup (5 分 window)

LINE WORKS が同一 event を再送した場合に副作用が二重実行されるのを防ぐため、`src/services/lineworks/callback/dedup.ts` で軽量 dedup を実施する。

- **Dedup key**: raw body の SHA-256 hex (`createHash('sha256').update(rawBody).digest('hex')`)。LINE WORKS の callback payload には event ID 相当のフィールドが無いため、payload 全体のハッシュをキーにする
- **TTL**: 5 分。同じ key が直近 5 分以内に届いていれば skip して 200 を返す (LINE WORKS の再送を黙らせる)
- **失敗時 retry**: 501 への転送が throw した場合 (= 501 が 5xx / network error) は dedup key を `unregister` して LINE WORKS の再送を許可する。`unregister` を呼ばないと転送失敗の event が再送されても skip されて喪失する
- **検証順序**: 署名検証 → dedup → JSON parse → Zod 検証 → 501 へ転送

⚠️ **Cloud Run の min-instances=1 / max-instances=20 制約と一緒に運用**する設計。Map は in-memory なので instance が複数走ると instance ごとに別 Map になり dedup が破綻する。`cloudbuild.yaml` で `--min-instances=1 --max-instances=20` を明示済だが、トラフィックが増えて auto-scale で 2 instance 目が立ち上がる頻度が上がってきたら、Redis 等の共有ストアへ移行する必要がある (現状は 1 instance に張り付き、min-instances=1 なので問題なし)。

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

### 応答コマンド (= 501 側で処理)

検証を通った event は **501 (scheduler-501) に転送**され、応答コマンド (`/help` / `/echo` / `/today` / `/status` 等) は **501 側の `src/services/lineworks/callback/handlers/` で処理**する (Google Calendar / scheduler 等 501 のドメインが必要なため)。wmbot は LINE WORKS gateway として受けて素通しするだけ。

> wmbot 内にも `services/lineworks/callback/{dispatch,handlers,reply}.ts` のローカル handler 雛形が残っているが、案 B では**呼ばれない** (二重応答を避けるため転送 1 本に統一)。応答コマンドの追加は 501 側で行う。

転送先は env `FORWARD_501_CALLBACK_URL` (= 501 の `/callback` URL) で指定。未設定なら転送せず素通し skip (= 開発時に 501 を立てていなくても 200 を返す)。

### 初回セットアップ手順 (Developer Console)

1. [Developer Console](https://developers.worksmobile.com/jp/console/) → **Bot** → 該当 Bot → 編集
2. **Bot Secret** をコピーして、Secret Manager に投入:
   ```sh
   pbpaste | gcloud --project=<PROJECT_ID> secrets create lineworks-bot-secret --data-file=- --replication-policy=automatic
   gcloud --project=<PROJECT_ID> secrets add-iam-policy-binding lineworks-bot-secret \
     --member=serviceAccount:worksmobile-message-bot-sa@<PROJECT_ID>.iam.gserviceaccount.com \
     --role=roles/secretmanager.secretAccessor
   ```
3. Cloud Run へ再デプロイ (Secret Manager マウントを反映するため。`main` への push でも可)
4. Bot 編集画面の **Callback URL** を `On` にして:
   - URL: `https://<本番ドメイン>/callback` (例: `https://line-works.api.miraius.co.jp/callback`)
   - 受信する Callback Event を必要なものだけ ON (`Message Event` / `Postback Event` / `Join` / `Leave` / `Joined` / `Left` / `Begin` / `End`)
5. Bot ポリシーで「1:1 トーク」「複数人トーク」を許可 (受信するイベントに応じて)
6. **保存** → LINE WORKS の自分宛 Bot にメッセージ `/help` を送って、ヘルプ文が返信されることを確認

> ⚠️ Callback URL を On にする前に、Cloud Run 側に `/callback` ルートがデプロイ済であることを必ず確認する。デプロイ前に On にすると LINE WORKS の callback が 404 を返し、イベントが失われる (LINE WORKS は再送しない)。

***

## ライセンス

MIT ライセンスの下で公開されています。
