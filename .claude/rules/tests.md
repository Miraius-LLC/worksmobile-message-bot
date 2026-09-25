# テスト規約（Develop 共通）— 常駐入口

`bun:test` を使い、壊れた時の被害に応じて検証する（`~/Develop/AGENTS.md` §3.1）。unit / feature の置き場、mock・時刻・env の例、pre-commit / pre-push の違いは `~/Develop/docs/develop-testing.md` をテストの作成・修正時に読む。

- 実 API・実 Secret Manager・実 JWT 署名をテストで走らせず、`mock.module` で差し替える（T1）。
- `mock.module` を使う SUT は静的 import せず、mock 設定後に `await import(...)` する。
- **共有 module の mock は複数 feature test にまたがってリークする**。ファイル間の評価順に依存する検査を作らない（L46）。
- push 前に対象 repo の `lefthook.yml` と `.lefthook/pre-push/` を読み、hook が走らせない必要な検査を手で回す。
