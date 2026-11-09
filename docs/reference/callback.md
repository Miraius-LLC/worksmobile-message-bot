# Callback (受信側)

LINE WORKS から Bot 宛のイベント (メッセージ送信 / ボタン押下 / トーク参加・退室 等) を受け取り、検証して必要なら設定済み upstream へ転送するエンドポイント。

### エンドポイント

| Endpoint    | HTTP | 説明                                                                                          |
| ----------- | ---- | --------------------------------------------------------------------------------------------- |
| `/callback` | POST | LINE WORKS からの [Bot Callback](https://developers.worksmobile.com/jp/docs/bot-callback) を受信 |

#### 認証

- 本文は署名検証前に実測で **1MiB（1,048,576 byte）** までに制限し、超過時は残りを読まず`413 callback body too large`で拒否する（wmbot独自の防御上限。公式上限ではない）。
- BASIC 認証は適用しない (LINE WORKS は BASIC 認証ヘッダを付けないため)
- 代わりに **`X-WORKS-Signature` ヘッダ (= raw body の HMAC-SHA256 を Bot Secret を鍵に計算し Base64 化した値) を検証**して真正性を担保する (検証 NG → `401 invalid signature`)
- 署名検証成功後、**`X-WORKS-BotId` ヘッダを検証**し、対象 Bot ID の一致を確認する (欠落 → `400 missing bot id`、不一致 → `403 bot id mismatch`)
- **検証順序**: 本文サイズ制限 → 署名検証 → Bot ID 検証 → dedup チェック (下記) → JSON.parse → Zod の `discriminatedUnion` で event 形式を確認 → 設定済み upstream へ同期 await 転送 → `200`を返す。upstream 408 / 429 / 5xx / network error はログを記録して `500` を返す。

#### Dedup (5 分 window)

LINE WORKS から同一 event が重複して届いた場合に副作用が二重実行されるのを防ぐため、`src/services/lineworks/callback/dedup.ts` で軽量 dedup を実施する。

- **Dedup key**: raw body の SHA-256 hex (`createHash('sha256').update(rawBody).digest('hex')`)。LINE WORKS の callback payload には event ID 相当のフィールドが無いため、payload 全体のハッシュをキーにする
- **TTL**: 5 分。同じ key が直近 5 分以内に届いていれば skip して 200 を返す (重複実行を抑止)
- **失敗時リセット**: upstream への同期 await 転送が 408 / 429 / 5xx または network error で失敗した場合は `500` とログ出力を行い、dedup key を `unregister` する。これは手動再投入時の再実行を受け入れるためであり、LINE WORKS の自動再送契約を前提にしない。厳密な非消失は Durable Queue を将来 TODO とする。
- **不正 payload は残さない**: JSON parse / Zod 検証で `400` を返すときも dedup key を `unregister` する。同じ不正 payload を 5 分以内に再送しても毎回 `400` になる
- **検証順序**: 署名検証 → Bot ID 検証 → dedup → JSON parse → Zod検証 → 設定済みupstreamへ転送

⚠️ **Workersのisolate間、およびCloud Runのinstance間でwmbot内のMapは共有されない**ため、
callback dedupはどちらの基盤でもbest effortです。厳密な一回処理が必要な場合は、
共有永続ストアまたは転送先でのidempotencyを実装してください。

#### 受信できる event 種別

`discriminatedUnion('type', [...])` で 8 種を網羅:

| type       | 発火タイミング                                              |
| ---------- | ----------------------------------------------------------- |
| `message`  | メンバーが Bot にメッセージを送った (text / image / etc.)  |
| `postback` | ボタンテンプレート等の postback action が押された           |
| `join`     | Bot が複数人トークに招待された                              |
| `leave`    | Bot が複数人トークから退出した                              |
| `joined`   | Bot が属するトークルームに新メンバーが参加した              |
| `left`     | Bot が属するトークルームからメンバーが退出した              |
| `begin`    | 1:1 トーク開始 (メンバーが Bot との 1:1 トークを開いた)     |
| `end`      | 1:1 トーク終了                                              |

未知 type は 400 を返す (Zod 検証で reject)。

#### 新 callback event type への追従手順

LINE WORKS の仕様変更で event type が増えた場合は、`src/services/lineworks/callback/schemas.ts` だけを直す (route 層は `callbackEventSchema.safeParse` 1 回なので触らない):

1. `<type>EventSchema` を定義し (`source` の構成は event 種別ごとに違うのでファイル冒頭コメントを参照)、`callbackEventSchema` の `discriminatedUnion('type', [...])` に追加する
2. `callbackEventTypes` の配列にも type 名を足す (同ファイルの `schemas.test.ts` が種類数と横断検証で固定している)
3. 上記「受信できる event 種別」の表に行を足す

### Callback転送

`FORWARD_CALLBACK_URL`を設定すると、検証済みCallbackを任意のupstream serviceへ同期 await 転送する。
未設定の場合は転送せず、署名・payload検証とdedupだけを行って`200`を返す。公式 Callback ページで自動再送契約は確認できないため、転送失敗時の `500` は自動再送を保証せず、`unregister` は手動再投入用である。

### 初回セットアップ手順 (Developer Console)

1. [Developer Console](https://developers.worksmobile.com/jp/console/) → **Bot** → 該当 Bot → 編集
2. **Bot Secret**をコピーし、利用する基盤へ`BOT_SECRET`として登録する
   - Workers: `bunx wrangler secret put BOT_SECRET --config .config/wrangler.jsonc`
   - Cloud Run: Secret Managerの`lineworks-bot-secret`
3. 利用する基盤へのdeploy済み状態を確認する（Workersはbinding、Cloud RunはSecret Managerのマウントを確認する）
4. Bot 編集画面の **Callback URL** を `On` にして:
   - URL: `https://<your-domain>/callback`（例: `https://bot.example.com/callback`）
   - 受信する Callback Event を必要なものだけ ON (`Message Event` / `Postback Event` / `Join` / `Leave` / `Joined` / `Left` / `Begin` / `End`)
5. Bot ポリシーで「1:1 トーク」「複数人トーク」を許可 (受信するイベントに応じて)
6. **保存** → LINE WORKS の自分宛 Bot から callback が届き、署名検証を通過して設定済み upstream で受信できることを確認（業務固有の応答処理は upstream 側で行います）

> ⚠️ Callback URLをOnにする前に、選択したデプロイ先で`/callback`が応答することを確認してください。デプロイ前にOnにするとCallbackが404となり、イベントを失う可能性があります。
