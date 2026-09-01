# テスト規約 (Develop 共通) — 常駐 index

`bun test` を使う。`bun:test` API (`describe` / `test` / `expect` / `mock` / `setSystemTime` 等) は jest/vitest と同等。

**コード例・落とし穴の理由・pre-commit の内訳は `~/Develop/docs/develop-testing.md`。テストを書く / 直す / 落ちた原因を追う瞬間に読む。**
プロジェクト固有のモック例は各プロジェクトの `.claude/rules/tests-<topic>.md` (例: worksmobile の `tests-lineworks.md`)。

## ファイル配置

| 種別 | 場所 | 何をテストする |
|---|---|---|
| **unit** (co-located) | `src/foo/bar.test.ts` | 1 関数 / 1 モジュールの純粋ロジック。外部依存はモック |
| **feature** (集約) | `tests/<topic>/*.test.ts` | 複数モジュールに跨る性質 / HTTP boundary / 全件横断 |

- `*.test.ts` が bun の自動検出対象。**手動で `testMatch` を設定しない**
- import は本体と同じく `@/` エイリアス
- テスト用ヘルパは `src/test-helpers/` に集約 (preload もここ)
- tsconfig の `include` は `src/**/*` と `tests/**/*` の両方

## 毎回効く判断 hook

| # | 判断 hook |
|---|---|
| T1 | 実 API 呼び出し・実 Secret Manager・実 JWT 署名をテストで走らせない。`mock.module` で差し替える |
| T2 | `mock.module` は**静的 import より前**に評価される必要がある。SUT は `await import(...)` で取り込む |
| T3 | `mock.module` はファイル跨ぎでリークし、評価順は OS 依存。**共有モジュールを複数 feature test で mock しない** (macOS 緑 / CI Linux 赤の実事故: L46) |
| T4 | 日時固定は `setSystemTime`。`Date` をサブクラス化しない (型が narrow されて TS が通らない) |
| T5 | env の削除は `Reflect.deleteProperty`。`delete` は biome `noDelete`、`= undefined` は文字列 `"undefined"` が入る |
| T6 | `NODE_ENV` は preload (`src/test-helpers/setup.ts`) で `'test'` を強制する。`.env` が test にも効くため |
| T7 | pre-commit は staged 関連のみ、pre-push が全件。**push 前にローカルで `bun test` 全件 pass** させてから push する |

## 何を書くか

- **書く**: 純粋関数 (`utils/*`) / `utils/config.ts` の Zod transform / Zod schema の個別検証 / dispatcher 系の組み立て / キャッシュ・single-flight (2 回呼んで内部 `fetch` が 1 回) / route handler (`app.request(new Request(...))` 経由)
- **書かない**: 実 API 呼び出し / 実 Secret Manager アクセス / 実 JWT 署名 (`node:crypto`)
