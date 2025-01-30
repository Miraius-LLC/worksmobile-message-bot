# Webhook Bot Messenger for LINE Works

![](https://img.shields.io/badge/-Node.js-339933.svg?logo=node.js&style=flat-square)![](https://img.shields.io/badge/-Line-00C300.svg?logo=line&style=flat-square)

社内で [LINE Works API](https://developers.worksmobile.com/jp/docs/api) を利用して各種メッセージ（テキスト、画像、ファイル、カルーセルなど）を Bot から送信するための Webhook サーバーです。 [IFTTT](https://ifttt.com/) や [Make](https://www.make.com/) などのノーコードツールから Webhook 経由で手軽に利用したいので作りました。

### 参考にさせていただいた記事

- [チュートリアル - 応答 Bot を作る | LINE Developers](https://developers.line.biz/ja/docs/messaging-api/nodejs-sample/)
- [Make で LINE WORKS API を実行してみる (OAuth2.0) #LINEWORKS - Qiita](https://qiita.com/mmclsntr/items/98922edd6046d4294a23)
- [【Node.js × LINE WORKS API】API で BOT を登録する #初心者向け - Qiita](https://qiita.com/kunihiros/items/33e6ddf11ba9b08835d9)

---

## 環境変数の設定

環境変数を `.env` ファイルに設定。

```env
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
SERVICE_ACCOUNT=your_service_account
PRIVATE_KEY=your_private_key_base64_encoded
BOT_ID=your_bot_id
```

- **CLIENT_ID**: `LINE Works API のクライアント ID`
- **CLIENT_SECRET**: `クライアントシークレット`
- **SERVICE_ACCOUNT**: `サービスアカウント`
- **PRIVATE_KEY**: `Base64 エンコードされたプライベートキー`

  - `base64 -i ./private_XXXXXX.key | pbcopy` して貼り付ける。

- **BOT_ID**: `Bot ID`

---

## セットアップ手順

1. リポジトリをクローン

   ```zsh
   $ git clone <repository-url> && cd <repository-directory>
   ```

2. 依存パッケージをインストール

   ```zsh
   $ npm install
   ```

3. 環境変数の設定

   - `<repository-directory>/` `.env` ファイルを作成し、必要な環境変数を設定。

4. 起動
   ```zsh
   $ npm start
   ```
   開発モード
   ```zsh
    $ npm run dev # localhost:8080
   ```

---

## 使用方法

### 1. エンドポイント一覧

#### 共通設定

- 認証: BASIC AUTH

#### [トークルーム指定](https://developers.worksmobile.com/jp/docs/bot-channel-message-send)

- BASE URL: `/channels/{channelId}`

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
| `/{fileId}` | GET | [コンテンツダウンロード](https://developers.worksmobile.com/jp/docs/bot-attachment-get) |

---

### 2. リクエスト例

#### テキストメッセージ を送信

- Endpoint: `/channels/{channelId}/messages/type/text`
- HTTP: `POST`
- Body:
  ```json
  {
    "text": "こんにちは！"
  }
  ```

---

#### 画像メッセージ を送信

- Endpoint: `/channels/{channelId}/messages/type/image`
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

- Endpoint: `/channels/{channelId}/messages/type/file`
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

- Endpoint: `/channels/{channelId}/messages/type/button_template`
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

- Endpoint: `/channels/{channelId}/messages/type/carousel`
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

- Endpoint: `/channels/{channelId}/messages/type/text`
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
#### コンテンツアップロード を使ってファイルをアップロード

- Endpoint: `/attachments`
- HTTP: `POST`
- Body:
  ```md
    multipart/form-data
    Key: file
    Value: <file>
  ```

#### コンテンツダウンロード を使ってファイルをダウンロード 🚧

- Endpoint: `/attachments/{fileId}`
- HTTP: `GET`


***

## ライセンス

MIT ライセンスの下で公開されています。
