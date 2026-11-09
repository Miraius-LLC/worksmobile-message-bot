# 開発コマンドと反映の流れ

## 主要コマンド

| 用途 | コマンド |
|---|---|
| 開発サーバ起動 (ホットリロード) | `bun run dev` |
| 型チェック | `bun run typecheck`（内蔵 `bun --check`） |
| 出荷前の全検査 (CIと同じ spec検証・型・Biome・テスト) | `bun run check` |
| Lint / format (auto-fix) | `bunx biome check --write ./src ./tests ./scripts` |
| 本番ビルド (`build/index.js` を出力) | `bun run build` |
| 本番ビルドを起動 | `bun run start` |
| Docker イメージビルド | `bun run docker:build` |
| pre-commit hook 有効化 | `bun run lefthook:install` |
| 1Password から `.env` 生成 | `bun run secrets:inject` |
| 1Password 参照の疎通確認 | `bun run secrets:check` |
| OpenSpec 操作 / strict 検証 | `bun run spec -- <command>` / `bun run spec:validate` |

`pre-commit` で biome auto-fix と `bun run typecheck` が走るため、手動で先回り実行する必要は無い。

## 変更の取り込み

通常の変更は `develop` に取り込む。pre-push は `check-release-version` による版照合だけ。`test:fast` は実 timer に依存する `src/services/lineworks/_fetch.test.ts` を除き、`bun run test` は同ファイルも含めて全件実行する。

## 本番への反映

本番へ反映するときは develop 上で `release patch`（または `minor`）→ `release push` を使う。`release push` が develop → main の順に同じ SHA を push し、main の検査成功後に tag と GitHub Release を作る。main の push で既存の Workers deploy が走る。Miraius-LLC の branch 作成・push は管理者の確認後に行う。
