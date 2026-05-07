# Service 層の規約・ゴッチャ

`src/services/lineworks/` の各モジュールは LINE WORKS Bot API の薄いラッパ。

## 共通規約

### `CALLER` 定数

各 service ファイル冒頭で必ず宣言する:

```ts
const CALLER = 'services/lineworks/auth'
```

メソッド単位で `${CALLER}.<method>` を logger オプションに渡す:

```ts
logger.success('ファイルをアップロード', { caller: `${CALLER}.uploadAttachment`, id: fileId })
```

これでログの出処が一意に追える。手書きで `caller: 'services/lineworks/auth.fetchAccessToken'` と全文を書かない。

### エラーハンドリング

- HTTP 失敗時は `response.text()` を `debug` フィールドに乗せて `logger.error` を出してから throw
- `throw new Error(...)` のメッセージは「何が失敗したか」+ `status=...` 程度に簡潔に
- 上位 (route handler) が catch → `reply.code(500).send({ error })` で返す
- `logger` を介さない `console.log` / `console.error` は使わない (Biome の `noConsole` で警告)

## auth (`services/lineworks/auth.ts`)

- `getServerToken()` が JWT 生成 → アクセストークン取得を 1 関数で実施。route 層からはこれだけ呼べば良い
- `PRIVATE_KEY` は Base64 デコードを前提とした扱い。`auth.ts` 内の `getPrivateKey` を経由する (生 PEM を渡してはいけない)
- JWT の `aud` は **`https://auth.worksmobile.com/oauth2/v2.0/token`** で固定。`AUTH_URL` 定数を共有しているのでズラさない
- スコープは `bot` 固定。`bot.message`, `bot.read` 等が必要になる場合は呼び出し側で URLSearchParams を組み直す

## api (`services/lineworks/api.ts`)

- `postJson(token, url, data)` が JSON POST の共通入口。message 系 / attachment 系の両方が依存
- `sendBotMessage(token, url, content)` は `{ content }` 形式で wrap して送る (LINE WORKS のメッセージ API 仕様)
- `getBotId()` で env var を引く。route 層 / service 層のどちらでも env を直読みせずこの関数経由で取得する

## messages (`services/lineworks/messages/`)

- 1 ファイル = 1 メッセージタイプ。型は `MessageSender = (botId, token, params) => Promise<void>` に揃える
- 送信先 (`channelId` / `userId`) は params に乗せる。`_send.ts` の `buildMessageUrl` がどちらか一方の存在を要求する
- 新メッセージタイプを足す時:
  1. `messages/<newType>.ts` で `MessageSender` を実装
  2. `messages/index.ts` の `messageSenders` マップに登録
  3. `routes/messages.ts` のループが自動で `/channels/:id/messages/type/<newType>` と `/users/:id/messages/type/<newType>` を登録する
- パラメータ検証は `src/utils/validates/` のヘルパで行う。各サービス内でアドホックに `typeof === 'string'` 判定しない

## attachment (`services/lineworks/attachment.ts`)

- **`uploadAttachment` は 2 段階リクエスト**: (1) `POST /bots/{botId}/attachments` で `uploadUrl` 発行 → (2) `uploadUrl` に multipart/form-data POST。1 関数にまとめてあるので呼び出し側でこの順序を意識する必要は無い
- `Blob` + `FormData` は Bun のネイティブ実装を使用。`form-data` パッケージや `multer` には依存しない
- **`resolveDownloadUrl` は 3xx 手動リダイレクト**: LINE WORKS のダウンロード API は 3xx で実 URL を返すため `redirect: 'manual'` で `Location` を抽出する。fetch のデフォルト (follow) は **リダイレクト先に Authorization ヘッダを付け直さない**ため使えない
- ダウンロードは route 側で `fetch(downloadUrl)` の body (`ReadableStream`) を `reply.send()` に直接流す。Fastify がストリーム送信に対応している
