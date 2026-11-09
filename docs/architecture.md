# アーキテクチャ

Cloudflare Workers と Cloud Run は、同じ Hono app を別のエントリから起動する。Workers は初回 request 時に binding を検証し、各 request を `app.fetch` に渡す。Cloud Run は起動時に環境変数を検証し、HTTP/1.1 で listen する。どちらもルート以降の処理は共通である。

## 送信と管理 API の流れ

1. 共通 app が trace・リクエストログ・セキュリティヘッダを適用する。ルート `/`、health probe、`/callback` を除くリクエストは BASIC 認証を通す。
2. LINE WORKS API を使うルートの middleware が server token を取得して `c.var.token` に渡す。token の JWT 生成、キャッシュ、期限切れ時の single-flight は認証サービス層が担う。
3. ルート層が path・query・JSON・multipart を受けて検証する。メッセージ送信では `messageSchemas` の型ごとの Zod schema が本文を検証し、添付アップロードでは 10 MB の body limit を適用する。
4. LINE WORKS サービス層が送信先 URL と API リクエストを組み立てる。メッセージ型は `messageSchemas` と `sendMessageByType` に集約し、チャンネルまたはユーザーの片方を送信先にする。添付のアップロード URL 発行とダウンロード時の 3xx Location 解決もサービス層が担う。
5. 共通 app が例外を処理する。LINE WORKS API のエラーは upstream の HTTP status と code・hint を返し、Hono の `HTTPException` は元の応答を保つ。それ以外はログを残して 500 を返す。

エンドポイント、入力制約、リクエスト例は [HTTP API](./reference/http-api.md) を参照。

## Callback の流れ

`/callback` は BASIC 認証から除外する。本文を実測 1 MiB で制限し、raw body の署名と Bot ID を検証する。その後、raw body の SHA-256 をキーに 5 分間の重複を in-memory Map で確認し、JSON と event schema を検証する。転送先が設定されていれば raw body と署名を upstream へ同期転送する。転送失敗や不正 payload では dedup key を取り消す。業務固有の応答処理は upstream 側が担う。

詳しい応答、再投入時の扱い、event 種別は [Callback](./reference/callback.md) を参照。環境変数と基盤ごとの設定は [環境変数](./reference/environment.md)、[Workers](./operations/deploy-workers.md)、[Cloud Run](./operations/deploy-cloud-run.md) を参照。
