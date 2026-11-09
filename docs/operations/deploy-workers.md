# Cloudflare Workers へのデプロイ

Cloudflare Workersでは、Cloud RunのNode serverと共通のHono appをWorker
`worksmobile-message-bot`から配信する。`nodejs_compat`は`wrangler.jsonc`で明示している。

GitHub Actions 経由でのデプロイ時は、Repository Variable `OAUTH_SCOPE` (`${{ vars.OAUTH_SCOPE }}`) を設定するとビルド時に `wrangler.production.json` の `vars.OAUTH_SCOPE` へ動的注入されます (未設定時は `bot` デフォルト)。

機密値は `wrangler secret put` で設定し、`OAUTH_SCOPE` は GitHub Actions Repository Variable または `wrangler.production.json` の `vars` で設定します。手動時は `wrangler deploy --var OAUTH_SCOPE:bot.message` を使用します。

```sh
bunx wrangler secret put CLIENT_ID
bunx wrangler secret put CLIENT_SECRET
bunx wrangler secret put SERVICE_ACCOUNT
bunx wrangler secret put PRIVATE_KEY
bunx wrangler secret put BOT_ID
bunx wrangler secret put BASIC_ID
bunx wrangler secret put BASIC_PASS
bunx wrangler secret put BOT_SECRET
bunx wrangler secret put FORWARD_CALLBACK_URL
bunx wrangler secret put CF_ACCESS_CLIENT_ID
bunx wrangler secret put CF_ACCESS_CLIENT_SECRET
```

`PRIVATE_KEY` は既存の Base64 文字列のまま保存する。`FORWARD_CALLBACK_URL` は必要な場合のみ登録する。

`CF_ACCESS_CLIENT_*` は転送先が Cloudflare Access の内側にいる場合だけ登録する。
**両方揃える**必要があり、片方だけだと Workers の初回 request 時に検証で落ちる。
転送が 401 / 403 で弾かれた場合は 200 を返さず throw するので、token の誤り・失効はログに出る
(黙って callback が消えない)。

```sh
# bundle 生成まで。外部へ deploy しない
bunx wrangler deploy --dry-run

# deploy（Custom Domainを使わない場合）
bunx wrangler deploy

# 直前の安定版へ rollback。特定版へ戻す場合は version ID を引数にする
bunx wrangler rollback
bunx wrangler rollback "$VERSION_ID"
```

本番 deploy と rollback は、対象 version と callback 疎通手順を確認してから実行する。

### Custom Domain

GitHub ActionsからCustom Domainへdeployする場合は、Repository Variable
`WORKER_CUSTOM_DOMAIN`にhostnameを登録する。workflowは公開用の一時Wrangler configを生成し、
`wrangler.jsonc`自体には環境固有のhostnameを保持しない。手動deployでは同等の`routes`設定を
ローカルの一時configへ追加する。
既存のDNS recordと競合する場合は、切替前に移行元・移行先のhealth checkとrollback手順を
用意したうえでDNSを更新する。切替後はTLS、`/healthz`、認証付きroute、Callbackを確認する。

### 観測

- Workersへデプロイした場合のlive logは`bunx wrangler tail worksmobile-message-bot`で確認する。
- 各log entryには`severity`（`INFO` / `ERROR`等）が付く。
- Cloud Runへデプロイした場合はCloud Loggingで確認する。`x-cloud-trace-context`ヘッダがあれば
  `logging.googleapis.com/trace`フィールドが付き、Traceタブで1 requestのlogをグループ化できる。
- `scripts/setup-monitoring.sh`は実行基盤に依存しないHTTPS uptime監視だけを設定する。
  事前に作成したCloud Monitoring Notification Channelのresource nameを
  `NOTIFICATION_CHANNEL_ID`で渡す。
- Cloud Run固有のログベース指標と通知が必要な場合だけ、
  `scripts/setup-cloud-run-log-monitoring.sh`を追加で実行する。
