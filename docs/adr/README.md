# Architecture Decision Records

本リポの**設計決定の単一の家**。「なぜそうしたか」はここに集約する（用語集は [`CONTEXT.md`](../../CONTEXT.md)、運用ゴッチャは [`CLAUDE.md`](../../CLAUDE.md)、エンドポイント仕様は [`README.md`](../../README.md)）。

## 形式

- ファイル名は連番 `0001-slug.md`。新規は最大番号 + 1。
- 本文は短く（多くは 1 段落）。タイトル + 「文脈・決定・理由」。代替案の却下理由が非自明なときだけ「検討した代替」を足す。
- ADR を起こすのは **3 条件すべてが真のとき**: ①後から変えるコストが大きい ②文脈なしでは「なぜこうした?」と訝られる ③本物のトレードオフの結果。どれか欠ければ起こさない（純粋な運用ゴッチャは CLAUDE.md に残す）。

新しい決定は `grill-with-docs` skill で詰める過程で確定したら、その場で ADR を emit する（lazy）。

## Index

### 基盤 / 実行環境
- [0001](./0001-cloud-run-hono-bun.md) — webhook サーバは Cloud Run + Hono + Bun
- [0002](./0002-container-http1-only-no-h2c.md) — コンテナは HTTP/1.1 のみ、end-to-end h2c 不採用

### 認証 / 認可
- [0003](./0003-jwt-node-crypto-rs256.md) — JWT は node:crypto で自前生成（RS256）
- [0006](./0006-basic-auth-except-health-and-callback.md) — BASIC 認証を `/` と health probe / callback 以外に強制

### Callback（受信）
- [0004](./0004-callback-dedup-in-memory-5min.md) — callback dedup は in-memory Map・5 分 window
- [0005](./0005-forward-callback-to-501.md) — callback を 501 に転送する（案 B）

### メッセージ送信（outbound）
- [0007](./0007-message-type-dispatcher.md) — メッセージ型 dispatcher（個別 sender なし）

### Docker / デプロイ
- [0008](./0008-docker-cloud-build-constraints.md) — Docker / Cloud Build の制約
- [0009](./0009-dedicated-runtime-sa-public-repo-secrets.md) — 専用 runtime SA + 公開リポ向け secret 運用
