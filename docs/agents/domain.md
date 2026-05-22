# Domain docs

engineering skill（`tdd` / `grill-with-docs` / `improve-codebase-architecture` / `diagnose` / `zoom-out`）が本リポの技術文書をどう読むか。

**single-context**（本リポは LINE WORKS Bot の Webhook サーバー 1 つ。`src/routes` / `src/services` / `src/utils` は技術レイヤであって別コンテキストではない。`CONTEXT-MAP.md` は無い）。

## 探索の前に読むもの

- **[`CONTEXT.md`](../../CONTEXT.md)**（repo root） — 技術用語集。出力（テスト名・仮説・リファクタ提案）で概念を呼ぶときは、ここで定義された正規語（MessageTarget / メッセージ型 / server token / callback / dedup / forward / 添付 / Bot API）を使う。`_Avoid_` の同義語に流れない。
- **[`docs/adr/`](../adr/)** — 着手領域に触れる Architecture Decision Record を読む。出力が既存 ADR と矛盾するなら黙って上書きせず明示する（例:「ADR-0002（コンテナは HTTP/1.1 のみ）と矛盾するが再検討の価値あり…」）。

## 補助文書

- **[`README.md`](../../README.md)** — エンドポイント仕様の SoT。全 HTTP ルート、各メッセージ型のリクエスト本文制約（LINE WORKS spec 準拠）、callback 受信フローの仕様を持つ。**用語集ではない**（用語集は CONTEXT.md）。
- **[`CLAUDE.md`](../../CLAUDE.md)** — コードから読めない規約・運用ゴッチャ（MUST / よくあるハマり / Docker・デプロイ / 命名）。決定の「なぜ」は ADR、ここは「触るとき気をつけること」。
- **[`.claude/rules/`](../../.claude/rules/)** — 作業別の規約。`routes.md`（HTTP エンドポイント追加）/ `services.md`（LINE WORKS API ラッパ）/ `tests-lineworks.md`（典型モック・app.request・multipart）。living spec であって決定（ADR）ではない。

## 用語集に無い概念に出くわしたら

CONTEXT.md にまだ無い概念が必要になったら、それは signal:
- プロジェクトが使っていない語を発明しかけている（再考する）か、
- 本当に語彙の穴がある（`grill-with-docs` で確定して CONTEXT.md に追記する）。
