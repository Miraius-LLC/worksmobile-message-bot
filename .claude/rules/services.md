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

## messages (`services/lineworks/messages/index.ts`)

- 全 10 メッセージ type の Zod schema + 汎用 dispatcher `sendMessageByType` を **単一ファイルに集約**。type ごとの sender 関数は書かない
- 送信先は route 層が `MessageTarget = { channelId } | { userId }` を組み立てて `sendMessageByType` に渡す
- 新メッセージタイプを足す時:
  1. `messages/index.ts` 内に Zod schema (`<type>BodySchema`) を定義
  2. 同ファイルの `messageSchemas` マップにキーを追加 (キーは LINE WORKS の URL の type 部分そのまま、スネークケース)
  3. `routes/messages.ts` のループが自動で `(channels|users)/:id/messages/type/<newType>` + zValidator を attach
  4. sender 関数は書かない。Zod の検証済 body を `{ type, ...body }` の形で `sendMessageByType` がそのまま POST する。LINE WORKS の wire format に揃わない場合は schema 側で `.transform()` するか、特殊処理が要る場合のみ別関数化
- 検証は **Zod schema 1 箇所で完結**。`if (!body.text) throw ...` のような検証は書かない
- 共通 sub-schema (`urlSchema` / `imageUrlSchema` / `defaultActionSchema` / `labeledActionSchema` / `quickReplySchema`) は同ファイル冒頭セクションにまとめてある
- エラーメッセージは日本語化される (`utils/zod-locale.ts` の `installJapaneseErrorMap` が `index.ts` で 1 度だけ呼ばれる)

## attachment (`services/lineworks/attachment.ts`)

- **`uploadAttachment` は 2 段階リクエスト**: (1) `POST /bots/{botId}/attachments` で `uploadUrl` 発行 → (2) `uploadUrl` に multipart/form-data POST。1 関数にまとめてあるので呼び出し側でこの順序を意識する必要は無い
- `Blob` + `FormData` は Bun のネイティブ実装を使用。`form-data` パッケージや `multer` には依存しない
- **`resolveDownloadUrl` は 3xx 手動リダイレクト**: LINE WORKS のダウンロード API は 3xx で実 URL を返すため `redirect: 'manual'` で `Location` を抽出する。fetch のデフォルト (follow) は **リダイレクト先に Authorization ヘッダを付け直さない**ため使えない
- ダウンロードは route 側で `fetch(downloadUrl)` の body (`ReadableStream`) を `reply.send()` に直接流す。Fastify がストリーム送信に対応している
