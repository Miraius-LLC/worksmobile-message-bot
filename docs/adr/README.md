# Architecture Decision Records

本リポの**設計決定の単一の家**。「なぜそうしたか」はここに集約する（用語集は [`CONTEXT.md`](../../CONTEXT.md)、運用ゴッチャは [`CLAUDE.md`](../../CLAUDE.md)、エンドポイント仕様は [`README.md`](../../README.md)）。

## 形式

- 新規ADRは[`adr-template.md`](./adr-template.md)を複製し、標準形式を使う。既存ADRのOriginal Recordは原則保存する。ただし公開repositoryへ置けない環境固有情報はprivate infra SoTへ移し、公開側には`Sanitized Original Record`として判断の骨格とredaction理由を残す。
- ファイル名は連番 `0001-slug.md`。新規は最大番号 + 1 とし、欠番を再利用しない。
- `status: accepted` になった ADR は原則として書き換えず、新しい判断で置き換える場合は後継 ADR を追加して supersede 関係を記録する。
- 新規 ADR を追加した変更では、本 README の索引も同時に更新する。
- ADR を起こすのは **3 条件すべてが真のとき**: ①後から変えるコストが大きい ②文脈なしでは「なぜこうした?」と訝られる ③本物のトレードオフの結果。どれか欠ければ起こさない（純粋な運用ゴッチャは CLAUDE.md に残す）。

新しい決定は `grill-with-docs` skill で詰める過程で確定したら、その場で ADR を emit する（lazy）。

## Index

### 基盤 / 実行環境
- [0001](./0001-cloud-run-hono-bun.md) — webhook サーバは Cloud Run + Hono + Bun
- [0010](./0010-dual-cloud-deployment.md) — WorkersとCloud Runの両方へデプロイ可能にする
- [0002](./0002-container-http1-only-no-h2c.md) — コンテナは HTTP/1.1 のみ、end-to-end h2c 不採用

### 認証 / 認可
- [0003](./0003-jwt-node-crypto-rs256.md) — JWT は node:crypto で自前生成（RS256）
- [0006](./0006-basic-auth-except-health-and-callback.md) — BASIC 認証を `/` と health probe / callback 以外に強制

### Callback（受信）
- [0004](./0004-callback-dedup-in-memory-5min.md) — callback dedupはin-memory Map・5分window
- [0005](./0005-forward-callback-to-upstream.md) — callbackを設定可能なupstreamへ転送する

### メッセージ送信（outbound）
- [0007](./0007-message-type-dispatcher.md) — メッセージ型 dispatcher（個別 sender なし）

### Docker / デプロイ
- [0008](./0008-docker-cloud-build-constraints.md) — Docker / Cloud Build の制約
- [0009](./0009-dedicated-runtime-sa-public-repo-secrets.md) — 専用 runtime SA + 公開リポ向け secret 運用
