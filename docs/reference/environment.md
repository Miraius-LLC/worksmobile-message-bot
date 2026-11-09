# 環境変数と OAuth Scope

## 環境変数の設定

ローカルの `.env` は 1Password から生成する。

```sh
bun run secrets:inject
```

`secrets:inject` は島共通の `develop-secrets` に `.config/develop-secrets.jsonc` を渡す。宣言は `.env.tpl` の `op://` 参照 8 件を入力とし、参照のない行は取得対象外にする。値を表示せず `.env` にマージし、既存の未管理キーやコメントは残す。必須の参照が 1 件でも取得できなければ `.env` は書き換えない。`secrets:check` は書き込まずに 1Password 参照の疎通だけ確認する。

手動で作成する場合は以下を設定する。

```env
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
SERVICE_ACCOUNT=your_service_account
PRIVATE_KEY=your_private_key_base64_encoded
BOT_ID=your_bot_id
BOT_SECRET=your_bot_secret
BASIC_ID=your_basic_auth_username
BASIC_PASS=your_basic_auth_password

# 任意
PORT=8080         # listen ポート (default 8080)
LOG_PRETTY=1      # 開発時のみ。pino-pretty でカラー出力
OAUTH_SCOPE=bot   # (任意) OAuth 認可スコープ: bot (default) | bot.message | bot.read
```

| 変数 | 内容 |
|---|---|
| `CLIENT_ID` | LINE WORKS API のクライアント ID |
| `CLIENT_SECRET` | クライアントシークレット |
| `SERVICE_ACCOUNT` | サービスアカウント |
| `PRIVATE_KEY` | Base64 エンコードされたプライベートキー (`base64 -i ./private_XXXXXX.key \| pbcopy`) |
| `BOT_ID` | Bot ID |
| `BOT_SECRET` | Bot Secret (Callback の `X-WORKS-Signature` HMAC-SHA256 検証鍵)。Developer Console の Bot 詳細から取得した値をそのまま入れる (Base64 デコード等は不要) |
| `BASIC_ID` | webhook 公開エンドポイント保護用の BASIC 認証ユーザ名 |
| `BASIC_PASS` | BASIC 認証パスワード |
| `FORWARD_CALLBACK_URL` | (任意) 受信Callbackを転送するupstream serviceのURL。未設定なら転送せず200を返す |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | (任意) 転送先が Cloudflare Access の内側にいる場合の service token。`CF-Access-Client-Id` / `CF-Access-Client-Secret` として付ける。**両方揃わないと Cloud Run は起動時、Workers は初回 request 時の検証で落ちる** (片方だけ = 守っているつもりで素通り、を防ぐ) |
| `OAUTH_SCOPE` | (任意) OAuth 認可スコープ (`bot` / `bot.message` / `bot.read`)。未設定時は `bot` |
| `PORT` | listen ポート (省略時 `8080`) |
| `NODE_ENV` | `production` でログレベルを `warn` 以上に絞る (`logger-impl.ts`。4xx は warn で残しつつ Error Reporting には乗せない運用)。development では `debug` まで出す。production では `shouldUsePretty` が `LOG_PRETTY=1` を無視して JSON 出力に倒す |
| `LOG_PRETTY` | `1` で pino-pretty 経由のカラー出力 (development のみ有効) |
| `GOOGLE_CLOUD_PROJECT` | Cloud Run 上で設定すると Cloud Logging trace 連携が fully-qualified resource name 形式 (`projects/<id>/traces/<traceId>`) で出る (`.config/cloudbuild.yaml` のデプロイ step で自動注入される)。未設定なら trace ID 単独 |

本番の機密値 (`CLIENT_SECRET` / `PRIVATE_KEY` / `BOT_SECRET` / `BASIC_ID` / `BASIC_PASS`) は、Cloud Run では Secret Manager の `lineworks-*:latest` をマウントし ([初回設定](../operations/deploy-cloud-run.md#初回設定))、Workers では `wrangler secret put` で渡す。env は `src/utils/config.ts` の Zod schema が Cloud Run は起動時、Workers は初回 request 時に検証する。

### OAuth Scope の運用と注意点

LINE WORKS API 呼び出しに使用する OAuth 認可スコープは環境変数 `OAUTH_SCOPE` で選択可能です。

- **未設定時**: デフォルト値 `bot` が使用され、既存利用者の挙動を変更しません。
- **`bot.message`**: メッセージ送信・メッセージ受信・メニュー（固定/リッチ）・トークルーム（チャンネル）操作・コンテンツ（添付ファイル）送受信を中心に利用する場合のスコープ。
- **`bot`**: Bot CRUD やドメイン管理を含む現行すべての機能を利用する場合のスコープ。
- **`bot.read`**: GET 可能な読み取り専用 API の範囲で[公式 API ドキュメント](https://developers.worksmobile.com/jp/docs/auth-scope)を確認のうえ利用するスコープ。
  > ⚠️ **注意**: `bot.read` ではメッセージ送信や Bot 更新などの書き込み系 route (write route) は動作せず、公式 API から認可エラー (403 等) が返されます。本サーバーではローカル事前拒否を行わず公式 API のエラーをそのまま返却します。
