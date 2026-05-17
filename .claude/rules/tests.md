# テスト規約 (Develop 共通)

`bun test` を使う。`bun:test` API (`describe` / `test` / `expect` / `mock` / `setSystemTime` 等) は jest/vitest と同等。

プロジェクト固有のモック例・典型パターンは各プロジェクトの `.claude/rules/tests-<topic>.md` (例: worksmobile の `tests-lineworks.md`) に分離する。

## ファイル配置

テストは 2 種類。役割で配置場所を分ける。

| 種別 | 場所 | 例 | 何をテストする |
|---|---|---|---|
| **unit** (co-located) | `src/foo/bar.test.ts` | `src/utils/config.test.ts` | 1 関数 / 1 モジュールの純粋ロジック。外部依存はモック |
| **feature** (集約) | `tests/<topic>/*.test.ts` | `tests/routes/messages.test.ts` | 横断的な性質。複数モジュールに跨る性質 / HTTP boundary / 全件横断テスト |

共通ルール:
- `*.test.ts` が bun の自動検出対象。手動で `testMatch` は設定しない
- import は本体と同じく `@/` エイリアスを使う
- テスト用ヘルパは `src/test-helpers/` に集約 (preload もここ)
- tsconfig の `include` は `src/**/*` と `tests/**/*` の両方

### unit (co-located) を選ぶ条件

- 1 ファイルの中で完結する純粋関数 / クラスのテスト (例: `utils/config.ts` の Zod transform, `utils/zod-locale.ts` のメッセージマップ)
- 個別 Zod schema の validation 動作
- 失敗時に「どの実装ファイルを直すか」が自明な粒度

### feature (`tests/`) を選ぶ条件

- **複数モジュールに跨る性質**。例: 「全 type の URL が `(channels|users)/:id/messages/type/<type>` に登録される」
- **system boundary をまたぐ**。例: Hono の `app.request(new Request(...))` 経由で route handler を叩く / multipart upload の `parseBody` を含む経路
- staged との対応関係が無い (どの src ファイルを編集しても全件走らせたい)

## pre-commit / pre-push 連携

`pre-commit` (高速・staged 関連のみ):
- staged な `src/**/*.{ts,tsx}` から関連 `.test.ts` を逆引きして実行 (`scripts/run-related-tests.ts` を作成して呼ぶ)
- 本体ファイル (`src/foo/bar.ts`) がステージされていれば **`src/foo/bar.test.ts` が走る**
- テスト自体 (`*.test.ts`) がステージされていればそれが走る
- 該当テストが無いコミット (README 編集等) はスキップして exit 0

`pre-push` (全件):
- `bun test` を全件実行 (co-located unit + `tests/` feature)
- pre-commit は staged された本体に対応する関連テストしか拾わないため、テストヘルパや preload (`src/test-helpers/setup.ts`) 経路で壊れる失敗を逃しがち。push 前に全件走らせて main を緑に保つ

新しいテストを書いたら **`bun test` がローカルで pass する状態でコミット / push** する (lefthook で落ちる)。

## NODE_ENV と `.env` の取り扱い

Bun は test 実行時にも `.env` 系ファイルを自動ロードするため、`.env` に `NODE_ENV="development"` 等が書いてあるとテストでもそのまま読み込まれる。`utils/config.ts` の Zod schema は `NODE_ENV` を読んで `isProduction` を決めるので、テストの挙動が `.env` の中身に左右されてしまう。

これを防ぐため、**`src/test-helpers/setup.ts` の冒頭で `process.env['NODE_ENV'] = 'test'` を強制設定**する。preload は `.env` のロード後に走るので、ここで上書きすれば `.env` 側の `NODE_ENV` は無視される。

NODE_ENV ごとの挙動を確認するテストでは、テスト内で `process.env['NODE_ENV'] = 'production'` 等に上書き → `afterEach` で `'test'` に戻す、というパターンを使う。

## ログのノイズを潰す preload

`bunfig.toml` の `[test].preload` で `src/test-helpers/setup.ts` を先読みし、`@/utils/logger` を no-op に差し替える。**テスト中に実装が `logger.error` 等を呼んでも標準出力は汚れない**。

実装が `logger.xxx` を呼んだことを検証したいテストでは、その test 内で再度 `mock.module('@/utils/logger', ...)` を呼んで上書きする。

## 日時を固定する

`Date` をサブクラス化すると `ConstructorParameters<typeof Date>` の型が narrow されて TS が通らない。**bun:test の `setSystemTime` を使う**:

```ts
import { setSystemTime, test, expect } from 'bun:test'

test('iat / exp が固定時刻基準で生成される', () => {
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
mock.module('@/services/foo', () => ({
  sendBotMessage: sendBotMessageMock,
  postJson: mock(async () => ({})),
}))

// ↓ mock 設定後に import (静的 import だと mock が間に合わない)
const { someFunction } = await import('@/services/bar')

test('mock が呼ばれる', async () => {
  sendBotMessageMock.mockClear()
  await someFunction('arg')
  expect(sendBotMessageMock).toHaveBeenCalled()
})
```

外部依存 (API への `fetch`, JWT 署名, Secret Manager) はテストで実体を読まない。`mock.module` で必要なメソッドだけ no-op / spy にする。

## 何を / 何をテストしないか

- **書く**:
  - 純粋関数 (`utils/*`)
  - `utils/config.ts` の Zod transform
  - Zod schema の個別検証
  - dispatcher 系 (汎用関数) の組み立てロジック
  - キャッシュ / single-flight (関数を 2 回呼んで内部の `fetch` が 1 回しか走らないこと)
  - route handler (Hono なら `app.request(new Request(...))` 経由)
- **書かない**:
  - 実 API 呼び出し (mock で差し替える)
  - 実 Secret Manager アクセス
  - 実 JWT 署名 (`node:crypto`)
- **テスト中は副作用を出さない**: 上記の実体や暗号系を走らせない

## 失敗時のデバッグ

- `bun test --bail` で最初の失敗で止める
- `bun test --only` で `test.only(...)` だけ走らせる
- preload で logger を黙らせているので、デバッグ時は preload を一時的に外す (`bunfig.toml` の `preload` 行をコメントアウト) と実装側のログが見える
