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

> 認証: `/` と health probe 系パス (`/healthz` / `/health` / `/readyz` / `/livez`) を除く全エンドポイントに **BASIC 認証**を要求する (`hono/basic-auth` を `src/app.ts` で `app.use('*', ...)` 経由でマウント)。credentials は `BASIC_ID` / `BASIC_PASS` env で注入し、本番では Secret Manager (`lineworks-basic-id` / `lineworks-basic-pass`) からマウントする。health probe 系は Cloud Run / k8s / Docker HEALTHCHECK 用に認証なしで公開しており、いずれも 200 OK + `{ status: "ok" }` を返す。`/healthz` を正、それ以外は互換用エイリアス。

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

***

## ライセンス

MIT ライセンスの下で公開されています。
