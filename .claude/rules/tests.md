# テストの規約

`bun test` を使う。`bun:test` API (`describe` / `test` / `expect` / `mock` / `setSystemTime` 等) は jest/vitest と同等。

## ファイル配置

テストは 2 種類。役割で配置場所を分ける。

| 種別 | 場所 | 例 | 何をテストする |
|---|---|---|---|
| **unit** (co-located) | `src/foo/bar.test.ts` | `src/utils/config.test.ts` | 1 関数 / 1 モジュールの純粋ロジック。外部依存はモック |
| **feature** (集約) | `tests/<topic>/*.test.ts` | `tests/routes/messages.test.ts` | 横断的な性質。複数モジュールに跨る性質 / HTTP boundary / `messageSchemas` 全件横断 |

共通ルール:
- `*.test.ts` が bun の自動検出対象。手動で testMatch は設定しない
- import は本体と同じく `@/` エイリアスを使う (`import { sendMessageByType } from '@/services/lineworks/messages'`)
- テスト用ヘルパは `src/test-helpers/` に集約 (preload もここ)
- tsconfig の `include` は `src/**/*` と `tests/**/*` の両方

### unit (co-located) を選ぶ条件

- 1 ファイルの中で完結する純粋関数 / クラスのテスト (例: `utils/config.ts` の Zod transform, `utils/zod-locale.ts` のメッセージマップ, `utils/trace.ts` の AsyncLocalStorage)
- 個別 Zod schema (`textBodySchema`, `flexBodySchema` 等) の validation 動作
- 失敗時に「どの実装ファイルを直すか」が自明な粒度

### feature (`tests/`) を選ぶ条件

- **複数モジュールに跨る性質**。例: 「`messageSchemas` の全 type が `sendMessageByType` で正しく `{ type, ...body }` 形式に組み立たる」「全 type の URL が `(channels|users)/:id/messages/type/<type>` に登録される」
- **system boundary をまたぐ**。例: Hono の `app.request(new Request(...))` 経由で `/health` や `/channels/:id/messages/type/text` を叩く / multipart upload の `parseBody` を含む経路
- staged との対応関係が無い (どの src ファイルを編集しても全件走らせたい)

## pre-commit / pre-push 連携

`pre-commit` (高速・staged 関連のみ) — `lefthook.yml` に既存の `biome` / `typescript` と並列で:
- staged な `src/**/*.{ts,tsx}` から関連 `.test.ts` を逆引きして実行 (`scripts/run-related-tests.ts` を作成して呼ぶ)
- 本体ファイル (`src/foo/bar.ts`) がステージされていれば **`src/foo/bar.test.ts` が走る**
- テスト自体 (`*.test.ts`) がステージされていればそれが走る
- 該当テストが無いコミット (README 編集等) はスキップして exit 0

`pre-push` (全件):
- `pre-push.full-test` が `bun test` を全件実行 (co-located unit + `tests/` feature)
- pre-commit は staged された本体に対応する関連テストしか拾わないため、テストヘルパや preload (`src/test-helpers/setup.ts`) 経路で壊れる失敗を逃しがち。push 前に全件走らせて main を緑に保つ
- 全件でも数秒なのでコストは無視できる

新しいテストを書いたら **`bun test` がローカルで pass する状態でコミット / push** する (lefthook で落ちる)。

## NODE_ENV と `.env` の取り扱い

Bun は test 実行時にも `.env` 系ファイルを自動ロードするため、`.env` に `NODE_ENV="development"` 等が書いてあるとテストでもそのまま読み込まれる。`utils/config.ts` の Zod schema は `NODE_ENV` を読んで `isProduction` を決めるので、テストの挙動が `.env` の中身に左右されてしまう。

これを防ぐため、**`src/test-helpers/setup.ts` の冒頭で `process.env['NODE_ENV'] = 'test'` を強制設定**している。preload は `.env` のロード後に走るので、ここで上書きすれば `.env` 側の `NODE_ENV` は無視される。

NODE_ENV ごとの挙動を確認するテストでは、テスト内で `process.env['NODE_ENV'] = 'production'` 等に上書き → `afterEach` で `'test'` に戻す、というパターンを使う。

## ログのノイズを潰す preload

`bunfig.toml` の `[test].preload` で `src/test-helpers/setup.ts` を先読みし、`@/utils/logger` を no-op に差し替える。**テスト中に実装が `logger.error` 等を呼んでも標準出力は汚れない**。

実装が `logger.xxx` を呼んだことを検証したいテストでは、その test 内で再度 `mock.module('@/utils/logger', ...)` を呼んで上書きする。

## 日時を固定する

`Date` をサブクラス化すると `ConstructorParameters<typeof Date>` の型が narrow されて TS が通らない。**bun:test の `setSystemTime` を使う**:

```ts
import { setSystemTime, test, expect } from 'bun:test'

test('JWT の iat / exp が 2026-05-11 基準で生成される', () => {
  setSystemTime(new Date('2026-05-11T00:00:00Z'))
  try {
    // ...
  } finally {
    setSystemTime() // 引数なしで復元
  }
})
```

## 環境変数の出し入れ

`utils/config.ts` の Zod schema は起動時に env を検証する。テストから env を差し替える場合、biome の `noDelete` ルールがあるため `delete process.env['X']` は使えない。`process.env.X = undefined` は文字列 `"undefined"` をセットしてしまうので NG。**`Reflect.deleteProperty(process.env, 'X')`** を使う:

```ts
let originalEnv: string | undefined
beforeEach(() => { originalEnv = process.env['NODE_ENV'] })
afterEach(() => {
  if (originalEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
  else process.env['NODE_ENV'] = originalEnv
})
```

## 外部モジュールのモック

`bun:test` の `mock.module(specifier, factory)` で差し替える。**static import より前に評価される必要があるため、SUT (System Under Test) は動的 import で取り込む**:

```ts
import { describe, expect, mock, test } from 'bun:test'

const sendBotMessageMock = mock(async () => {})
mock.module('@/services/lineworks/api', () => ({
  sendBotMessage: sendBotMessageMock,
  postJson: mock(async () => ({})),
  getBotId: () => 'test-bot',
}))

// ↓ mock 設定後に import (静的 import だと mock が間に合わない)
const { sendMessageByType } = await import('@/services/lineworks/messages')

test('text type は { type: "text", text } で送信される', async () => {
  sendBotMessageMock.mockClear()
  await sendMessageByType('text', { channelId: 'C1' }, { text: 'hi' }, 'tok')
  expect(sendBotMessageMock).toHaveBeenCalledWith('tok', expect.any(String), { type: 'text', text: 'hi' })
})
```

外部依存 (LINE WORKS API への `fetch`, `node:crypto` の JWT 署名, Secret Manager) はテストで実体を読まない。`mock.module` で必要なメソッドだけ no-op / spy にする。

### LINE WORKS 関連の典型モック

- `@/services/lineworks/auth` の `getServerToken` → 固定文字列を返すモックに差し替えて JWT 生成パスを丸ごとスキップ
- `@/services/lineworks/api` の `postJson` / `sendBotMessage` → spy 化して引数を断言
- `@/services/lineworks/attachment` の `uploadAttachment` / `resolveDownloadUrl` → spy / 固定値
- `fetch` (global) → 必要なら `mock.module` ではなく `globalThis.fetch = mock(...)` で差し替え、`afterEach` で復元

`tokenMiddleware` (`routes/_middleware.ts`) は `getServerToken` をモックすれば実装そのままで route テストを書ける。

## 何を / 何をテストしないか

- **書く**: 純粋関数 (`utils/*`), `utils/config.ts` の Zod transform, `services/lineworks/messages/index.ts` の Zod schema 個別検証 + `sendMessageByType` の組み立てロジック, `services/lineworks/auth.ts` のキャッシュ / single-flight (`getServerToken` を 2 回呼んで `fetch` が 1 回しか走らないこと), `routes/*` の Hono ハンドラ (`app.request(new Request(...))` 経由)
- **書かない**: 実 API 呼び出し (LINE WORKS Auth / Bot API / 添付 upload・download)。これらはモックで差し替える。リアル統合テストは現状なし
- **テスト中は副作用を出さない**: `getServerToken` の実体や `node:crypto` の署名は走らせない。`mock.module` で差し替えるか、最上位の関数を直接 spy 化する

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

`FormData` + `Blob` を組み立てて `messagesApp` ではなく `attachmentsApp` に `app.request(...)` で投げる。10MB の bodyLimit にかからない小さい Blob を使う。`uploadAttachment` 自体は mock 化して `fileId` を返させる。

### Zod schema 全件横断 (`tests/services/message-schemas.test.ts`)

`messageSchemas` を 1 度だけ取得して全 type を for-of で回し、「全 type が `safeParse({ ... 最小 fixture ... })` で success する」「`sendMessageByType` で組み立てた wire format が `{ type, ...body }` の形になっている」等の横断的性質を当てる。**top-level await** で取り込めば bun のデフォルト 5 秒 timeout に引っかからない:

```ts
const { messageSchemas } = await import('@/services/lineworks/messages')

for (const [type, schema] of Object.entries(messageSchemas)) {
  test(`${type} schema は最小 fixture で parse できる`, () => {
    expect(schema.safeParse(fixtureFor(type)).success).toBe(true)
  })
}
```

## 失敗時のデバッグ

`bun test --bail` で最初の失敗で止める。`bun test --only` で `test.only(...)` だけ走らせる。preload で logger を黙らせているので、デバッグ時は preload を一時的に外す (`bunfig.toml` の `preload` 行をコメントアウト) と実装側のログが見える。
