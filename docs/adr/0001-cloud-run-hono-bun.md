# webhook サーバは Cloud Run + Hono + Bun

Develop 標準として、cron / 常駐 / webhook 系のサーバは **Google Cloud Run**（asia-northeast1）にデプロイする。HTTP は **Hono on Bun**、`@hono/node-server` の `serve()` で listen し、SIGTERM を受けたら graceful shutdown する。Hono は Web 標準 Request/Response で動くため Cloud Run でも edge でも同じコードが通り、Bun を runtime + パッケージマネージャ + バンドラ + test runner として一本化できる。

IFTTT / Make 等のノーコードツールから Webhook 経由で LINE WORKS Bot を叩く薄いラッパという用途に、常時 1 インスタンス張り付き（[ADR-0004](./0004-callback-dedup-in-memory-5min.md) の min-instances=1 前提）の Cloud Run が噛み合う。

_出典: README.md 技術スタック / デプロイ, CLAUDE.md アーキテクチャ_
