# LINE WORKS 関連のテストパターン (worksmobile-message-bot 固有)

`.claude/rules/tests.md` (Develop 共通) の補足。LINE WORKS Bot API を扱う上での典型モックと feature テストの書き方をまとめる。

## LINE WORKS 関連の典型モック

- **`@/services/lineworks/auth` の `getServerToken`** → 固定文字列を返すモックに差し替えて JWT 生成パスを丸ごとスキップ
- **`@/services/lineworks/api` の `postJson` / `sendBotMessage`** → spy 化して引数を断言
- **`@/services/lineworks/attachment` の `uploadAttachment` / `resolveDownloadUrl`** → spy / 固定値
- **`fetch` (global)** → 必要なら `mock.module` ではなく `globalThis.fetch = mock(...)` で差し替え、`afterEach` で復元

`tokenMiddleware` (`routes/_middleware.ts`) は `getServerToken` をモックすれば実装そのままで route テストを書ける。

```ts
import { describe, expect, mock, test } from 'bun:test'

const sendBotMessageMock = mock(async () => {})
mock.module('@/services/lineworks/api', () => ({
  sendBotMessage: sendBotMessageMock,
  postJson: mock(async () => ({})),
  getBotId: () => 'test-bot',
}))
mock.module('@/services/lineworks/auth', () => ({
  getServerToken: mock(async () => 'fixed-token'),
}))

// ↓ mock 設定後に import
const { sendMessageByType } = await import('@/services/lineworks/messages')

test('text type は { type: "text", text } で送信される', async () => {
  sendBotMessageMock.mockClear()
  await sendMessageByType('text', { channelId: 'C1' }, { text: 'hi' }, 'tok')
  expect(sendBotMessageMock).toHaveBeenCalledWith('tok', expect.any(String), { type: 'text', text: 'hi' })
})
```

## feature テストの典型パターン

### Hono ハンドラ (`tests/routes/messages.test.ts`)

`messagesApp` を import して **`app.request(new Request(...))` で叩く**。`Bun.serve` を立てる必要は無い (Hono は Web 標準 Request/Response で動く):

```ts
import { messagesApp } from '@/routes/messages'

const res = await messagesApp.request('/channels/C1/messages/type/text', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content: { text: 'hi' } }),
})
expect(res.status).toBe(200)
```

`tokenMiddleware` で `c.var.token` に注入されるトークンは `getServerToken` をモックして固定値にしておく。

### 添付ファイル multipart (`tests/routes/attachments.test.ts`)

`FormData` + `Blob` を組み立てて `messagesApp` ではなく `attachmentsApp` に `app.request(...)` で投げる。10MB の `bodyLimit` にかからない小さい Blob を使う。`uploadAttachment` 自体は mock 化して `fileId` を返させる。

```ts
import { attachmentsApp } from '@/routes/attachments'

const fd = new FormData()
fd.append('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt')

const res = await attachmentsApp.request('/', {
  method: 'POST',
  body: fd,
})
expect(res.status).toBe(200)
const json = await res.json()
expect(json.fileId).toBeDefined()
```

### Zod schema 全件横断 (`tests/services/message-schemas.test.ts`)

`messageSchemas` を 1 度だけ取得して全 type を for-of で回し、「全 type が `safeParse({ ... 最小 fixture ... })` で success する」「`sendMessageByType` で組み立てた wire format が `{ type, ...body }` の形になっている」等の横断的性質を当てる。

**top-level await** で取り込めば bun のデフォルト 5 秒 timeout に引っかからない:

```ts
const { messageSchemas } = await import('@/services/lineworks/messages')

for (const [type, schema] of Object.entries(messageSchemas)) {
  test(`${type} schema は最小 fixture で parse できる`, () => {
    expect(schema.safeParse(fixtureFor(type)).success).toBe(true)
  })
}
```

## このプロジェクトで「書く」テストの具体例

- 純粋関数 (`utils/*`)
- `utils/config.ts` の Zod transform
- `services/lineworks/messages/index.ts` の Zod schema 個別検証 + `sendMessageByType` の組み立てロジック
- `services/lineworks/auth.ts` のキャッシュ / single-flight (`getServerToken` を 2 回呼んで `fetch` が 1 回しか走らないこと)
- `routes/*` の Hono ハンドラ (`app.request(new Request(...))` 経由)

## このプロジェクトで「書かない」テスト

- 実 LINE WORKS Auth / Bot API 呼び出し
- 実 添付 upload / download
- 実 Secret Manager アクセス
- 実 JWT 署名 (`node:crypto`)

これらは `mock.module` で差し替える。リアル統合テストは現状なし。
