# Webhook Bot Messenger for LINE WORKS

![Bun](https://img.shields.io/badge/-Bun-000000.svg?logo=bun&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6.svg?logo=typescript&logoColor=white&style=flat-square)
![Hono](https://img.shields.io/badge/-Hono-E36002.svg?logo=hono&logoColor=white&style=flat-square)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020.svg?logo=cloudflareworkers&logoColor=white&style=flat-square)
![Google Cloud Run](https://img.shields.io/badge/Cloud_Run-4285F4.svg?logo=googlecloud&logoColor=white&style=flat-square)
![Biome](https://img.shields.io/badge/-Biome-60A5FA.svg?logo=biome&logoColor=white&style=flat-square)
![LINE WORKS](https://img.shields.io/badge/-LINE_WORKS-00C300.svg?logo=line&logoColor=white&style=flat-square)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)

[LINE WORKS API](https://developers.worksmobile.com/jp/docs/api)を利用して各種メッセージ（テキスト、画像、ファイル、カルーセルなど）をBotから送信するWebhookサーバー。[IFTTT](https://ifttt.com/)や[Make](https://www.make.com/)などからWebhook経由でLINE WORKS Botを利用できる。

同じHono appをCloudflare Workers / Cloud Runのどちらでもデプロイできる。Workers向けの
Wrangler構成と、Cloud Run向けのDocker / Cloud Build構成を同じリポジトリで維持している。

![IFTTT、Make、n8n や AI エージェントからの Webhook 呼び出しは BASIC 認証と worksmobile-message-bot を通り、LINE WORKS API から指定のトークルームやユーザーへ届く。LINE WORKS の Callback は署名・Bot ID・重複・内容を順に検証して転送先へ渡す。](./docs/diagrams/request-flow.svg)

## 現在の構成

Cloudflare Workers と Cloud Run のエントリは共通の Hono app を使用する。
HTTP route が入力・認証を受け、LINE WORKS service がトークン取得と Bot API 呼び出しを担う。
Callback は署名と Bot ID を検証し、設定済みの upstream へ同期転送する。
詳しいリクエストの流れと各層の責務は[アーキテクチャ](./docs/architecture.md)を参照。

## セットアップ手順

事前に [Bun](https://bun.sh/) をインストール (`.config/mise.toml` の `[tools].bun` を読む [mise](https://mise.jdx.dev/) を推奨)。

```zsh
# 1. クローン
$ git clone <repository-url> && cd worksmobile-message-bot

# 2. 依存インストール
$ bun install

# 3. .env 作成 ([環境変数](./docs/reference/environment.md)を参照)

# 4. 起動
$ bun run dev      # 開発: ホットリロード + pretty log。localhost:8080
$ bun run build && bun run start  # 本番ビルド + 起動
```

### 主要コマンド

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

通常の変更は `develop` に取り込む。pre-push は `check-release-version` による版照合だけ。`test:fast` は実 timer に依存する `src/services/lineworks/_fetch.test.ts` を除き、`bun run test` は同ファイルも含めて全件実行する。

本番へ反映するときは develop 上で島の `release patch`（または `minor`）→ `release push` を使う。`release push` が develop → main の順に同じ SHA を push し、main の検査成功後に tag と GitHub Release を作る。main の push で既存の Workers deploy が走る。Miraius-LLC の branch 作成・push は管理者の確認後に行う。

---

## 文書

- [アーキテクチャ](./docs/architecture.md)
- [HTTP API とリクエスト例](./docs/reference/http-api.md)
- [Callback の受信と転送](./docs/reference/callback.md)
- [環境変数と OAuth Scope](./docs/reference/environment.md)
- [Cloud Run へのデプロイ](./docs/operations/deploy-cloud-run.md)
- [Cloudflare Workers へのデプロイ](./docs/operations/deploy-workers.md)
- [文書索引](./docs/README.md)

### 再開前の準備

Cloud Run の再開手順は[デプロイ手順](./docs/operations/deploy-cloud-run.md#再開前の準備)を参照。

## 技術スタック

- **実行基盤**: Cloudflare Workers / Google Cloud Run
- **ランタイム**: Workers runtime / [Bun](https://bun.sh/) 1.4.x（Cloud Run・ローカル）
- **言語**: TypeScript (ESM, strict)
- **HTTP フレームワーク**: [Hono](https://hono.dev/)（Workers と Cloud Run で共通 app を実行）
- **検証**: [Zod](https://zod.dev/) + [@hono/zod-validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator)
- **Linter / Formatter**: [Biome](https://biomejs.dev/) 2.x
- **Logger**: [pino](https://github.com/pinojs/pino) (+ pino-pretty in dev) — Workers logs / Cloud Run時のCloud Logging severity・trace連携
- **pre-commit**: [lefthook](https://github.com/evilmartians/lefthook)
- **CI**: GitHub Actions（develop / PR は lint・型検査・`test:fast`、main は OpenSpec・全テスト・Wrangler dry-run を含む全部入り）
- **CD**: GitHub Actions (CI 成功後) → Cloudflare Workers。Cloud Build → Cloud Runは休止中

## ライセンス

MIT ライセンスの下で公開されています。
