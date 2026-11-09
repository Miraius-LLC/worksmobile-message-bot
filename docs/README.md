# Docs

worksmobile-message-bot の文書入口。用語は root の `CONTEXT.md`、現在の構成への入口は root の `README.md`。エンドポイント仕様は [HTTP API](./reference/http-api.md) と [Callback](./reference/callback.md)。

## 構成と仕様

- [アーキテクチャ](./architecture.md)
- [HTTP API とリクエスト例](./reference/http-api.md)
- [Callback の受信と転送](./reference/callback.md)
- [環境変数と OAuth Scope](./reference/environment.md)

## 運用

- [Cloud Run へのデプロイ](./operations/deploy-cloud-run.md)
- [Cloudflare Workers へのデプロイ](./operations/deploy-workers.md)

## 設計判断

- [Architecture Decision Records](./adr/README.md)

## エージェント作業

- [Domain docs](./agents/domain.md)
- [Issue tracker](./agents/issue-tracker.md)

## 規約と文書標準

- [ドキュメント運用規約](./conventions/documentation.md)
- [文書標準](./reference/documentation-standard.md)

## 仕様の backfill

- [既存 ADR の OpenSpec backfill 設計](./superpowers/specs/2026-08-25-adr-openspec-backfill-design.md)

## 参考記事

- [チュートリアル - 応答 Bot を作る | LINE Developers](https://developers.line.biz/ja/docs/messaging-api/nodejs-sample/)
- [Make で LINE WORKS API を実行してみる (OAuth2.0) #LINEWORKS - Qiita](https://qiita.com/mmclsntr/items/98922edd6046d4294a23)
- [【Node.js × LINE WORKS API】API で BOT を登録する #初心者向け - Qiita](https://qiita.com/kunihiros/items/33e6ddf11ba9b08835d9)
