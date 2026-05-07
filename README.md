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

# 3. SA に accessor 権限を付与 (per-secret)
for s in lineworks-client-secret lineworks-private-key; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:worksmobile-message-bot-sa@<PROJECT_ID>.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done

# 4. 機密度の低い env を Cloud Run service に直接設定
gcloud run services update worksmobile-message-bot --region=asia-northeast1 \
  --set-env-vars=CLIENT_ID=...,SERVICE_ACCOUNT=...,BOT_ID=...

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

> 認証: 現状は未実装。Cloud Run の認証や前段プロキシで保護する想定。アプリ内で BASIC 認証等を必要とする場合は `hono/basic-auth` ミドルウェアを `src/index.ts` に追加する。

#### [トークルーム指定](https://developers.worksmobile.com/jp/docs/bot-channel-message-send)

- BASE URL: `/channels/{:channelId}`

| Endpoint                         | HTTP | 説明                                                                                                  |
| -------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `/messages/type/text`            | POST | [テキストメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-text)を送信                  |
| `/messages/type/sticker`         | POST | [スタンプメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-sticker)を送信               |
| `/messages/type/image`           | POST | [画像メッセージ](https://developers.worksmobile.com/jp/docs/bot-send-image)を送信                     |
| `/messages/type/file`            | POST | [ファイルメッセージ](https://developers.worksmobile.com/jp/docs/bot-send-file)を送信                  |
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

#### ボタンテンプレート を送信

- Endpoint: `/channels/{:channelId}/messages/type/button_template`
- HTTP: `POST`
- Content-Type: `application/json`
- Body:
  ```json
  {
    "altText": "ボタンテンプレートのサンプル",
    "template": {
      "type": "buttons",
      "title": "タイトル",
      "text": "ボタンを選択してください",
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
    "altText": "カルーセルメッセージのサンプル",
    "template": {
      "type": "carousel",
      "columns": [
        {
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
  }
  ```

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
          "type": "action",
          "action": {
            "type": "message",
            "label": "オプション1",
            "text": "選択肢1が選ばれました"
          }
        },
        {
          "type": "action",
          "action": {
            "type": "message",
            "label": "オプション2",
            "text": "選択肢2が選ばれました"
          }
        },
        {
          "type": "action",
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
