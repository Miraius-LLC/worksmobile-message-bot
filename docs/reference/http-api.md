# HTTP API

## 使用方法

### 1. エンドポイント一覧

> 認証: `/` と health probe 系パス (`/healthz` / `/health` / `/readyz` / `/livez`) + `/callback` を除く全エンドポイントに **BASIC 認証**を要求する (`hono/basic-auth` を `src/app.ts` で `app.use('*', ...)` 経由でマウント)。credentials は `BASIC_ID` / `BASIC_PASS` env で注入し、本番では Secret Manager (`lineworks-basic-id` / `lineworks-basic-pass`) からマウントする。health probe 系は Cloud Run / k8s / Docker HEALTHCHECK 用に認証なしで公開しており、いずれも 200 OK + `{ status: "ok" }` を返す。`/healthz` を正、それ以外は互換用エイリアス。`/callback` は LINE WORKS が BASIC 認証を喋らないため除外し、代わりに `X-WORKS-Signature` の HMAC 検証で真正性を担保する (詳細は[Callback (受信側)](./callback.md))。

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
| `/messages/type/flex`            | POST | [フレキシブルテンプレート](https://developers.worksmobile.com/jp/docs/bot-send-flex)を送信            |

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
| `/` | GET | 登録済リッチメニュー一覧 → 200 + `{ richmenus: [...], responseMetaData?: { nextCursor } }` |
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
| `/`                   | GET    | テナント内 Bot 一覧 → 200 + `{ bots: [...], responseMetaData?: { nextCursor } }`                    |
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
| `/`                   | GET    | Bot が登録されているドメイン一覧（`count` / `cursor`、`responseMetaData.nextCursor` 対応）             |
| `/{:domainId}`        | POST   | ドメインに Bot を登録                                                                          |
| `/{:domainId}`        | PUT    | ドメイン別 Bot 設定を完全置換                                                                  |
| `/{:domainId}`        | PATCH  | ドメイン別 Bot 設定を部分更新                                                                  |
| `/{:domainId}`        | DELETE | Bot をドメインから削除 (404 idempotent)                                                       |

---

### 主要な制約サマリ (LINE WORKS spec 準拠)

各 type のリクエスト本文はリクエストごとに Zod schema でバリデーションされる。仕様より緩いと
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
| 一覧APIの空の `?count=` | 未指定として扱い、upstreamへ転送しない |
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
