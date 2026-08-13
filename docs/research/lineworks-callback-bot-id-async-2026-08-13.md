# LINE WORKS Callback の Bot ID 検証および非同期処理方針の調査報告

## 主要結論 (TL;DR)

1. **LINE WORKS 公式仕様の真実 (一次情報)**
   - LINE WORKS 公式の Callback ページ ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback)) には `X-WORKS-BotId`、署名検証、200 応答、非同期化推奨は記載されているが、自動再送の有無は明記されていない (公式ページでは再送契約を確認できない)。
   - 公式ドキュメントでは、後続イベントの処理遅延を防ぐために **「イベント処理の非同期化」** が推奨されている ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。
   - リクエストヘッダーには `X-WORKS-BotId` (受信対象 Bot の識別子) が含まれ、HTTP ヘッダー名の規格通り大文字小文字は区別されない (`case-insensitive`) ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。

2. **Bot ID 検証の採用決定**
   - 署名検証 (`X-WORKS-Signature`) 成功後に、`X-WORKS-BotId` ヘッダを Hono の header API で大文字小文字非依存に取得して検証する。
   - 欠落時は `400 Bad Request` `{ error: "missing bot id" }`、設定値 (`config().botId`) との不一致時は `403 Forbidden` `{ error: "bot id mismatch" }` を返す。
   - 署名検証前に Bot ID 差分を返さない (署名検証 NG 時は常に `401 invalid signature`)。
   - ログ出力時は `hasBotId` / `botIdMismatch` の boolean フラグのみを記録し、期待値・受信値・Bot Secret 等の機密情報は出力しない。

3. **非同期方針の採用決定 (案 A: 現状の upstream await 維持)**
   - **採用案**: Cloud Run / Workers 共通で現状の `await forwardEventToUpstream(...)` を維持する。
   - **採択理由**:
     - Cloud Run では request-based CPU allocation やインスタンスシャットダウン ([Cloud Run Container Contract](https://docs.cloud.google.com/run/docs/container-contract)) のため、fire-and-forget は処理中断リスクがある。
     - Cloudflare Workers の `waitUntil` ([Cloudflare Workers Runtime API Context](https://developers.cloudflare.com/workers/runtime-apis/context/)) 単独採用は、Cloud Run との応答/障害契約が非対称になるため見送る。
   - **将来方針**: 厳密なイベント非消失・完全非同期化には Cloud Tasks / Cloudflare Queues 等の durable queue が必要であり、別 TODO として整理・保留する。

4. **Callback 送信失敗と再送契約の整理**
   - 公式ページでは自動再送契約を確認できないため、「500 応答で LINE WORKS 再送を許可する」という過去の断定を README・ADR・コードコメントから修正・整理する。
   - await 転送中の upstream 5xx / network error 時は現行の 500 返却とログ記録を維持するが、それは LINE WORKS の自動再送を前提としたものではない。`dedup unregister` は手動再投入時等の再実行用として扱う。

---

## 1. LINE WORKS 公式 Callback 仕様調査結果 (一次情報)

公式ドキュメント: [LINE WORKS Callback (メッセージの受信)](https://developers.worksmobile.com/jp/docs/bot-callback) および各イベントページ ([メッセージイベント](https://developers.worksmobile.com/jp/docs/bot-callback-message), [ポストバックイベント](https://developers.worksmobile.com/jp/docs/bot-callback-postback)) より確認。

### 1.1. `X-WORKS-BotId` の意味・検証方法・大文字小文字
- **意味**: イベントが発生した対象の Bot の識別子 (Bot ID)。単一または複数の Bot 宛てのイベントを単一の Callback 受信サーバーで処理する際、どの Bot 宛てかを識別するために使用される ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。
- **検証方法**: 受信 HTTP リクエストのヘッダーから `X-WORKS-BotId` の値を取り出し、自サーバーが管理する Bot ID (`BOT_ID` 設定値) と一致するか比較検証する。
- **header 名の大文字小文字**: HTTP/1.1 (RFC 7230) および HTTP/2 規格に従い、ヘッダー名は大文字小文字を区別しない (`case-insensitive`) ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。Hono 等のフレームワークでは `c.req.header('x-works-botid')` のように小文字キーで安全に取得可能。

### 1.2. 署名検証 (`X-WORKS-Signature`)
- **検証方法**: Bot Secret を HMAC 鍵とし、raw request body に対する HMAC-SHA256 を計算、そのダイジェストを Base64 エンコードした文字列を `X-WORKS-Signature` ヘッダーと比較する ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。タイミング攻撃を防ぐため `timingSafeEqual` 等の固定時間比較を行う。

### 1.3. レスポンス 200 および 失敗時再送の記載
- **レスポンス 200**: 「Callback を受け取ったボットサーバーから LINE WORKS のメッセージングサーバーへのレスポンスは、ステータスコード 200 で返してください」と明記されている ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。
- **自動再送の記載なし**: 公式 Callback ドキュメントには `X-WORKS-BotId`、署名検証、200 応答、非同期化推奨が記載されているが、自動再送の有無は明記されておらず、再送契約を確認できない ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。

### 1.4. イベント処理の非同期化推奨
- **公式記載**: 「HTTPS POST リクエストの処理が後続のイベントの処理に遅延を与えないよう、**イベント処理を非同期化することを推奨します**」と明確に記載されている ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。

---

## 2. 調査時の検討選択肢と最終決定の整理

### 2.1. 検討した 4 つの選択肢 (調査時)

- **(A) 現状の await 転送 (採用決定)**
  - **説明**: HTTP リクエストハンドラ内で `await forwardEventToUpstream()` の完了を待ってから `200` を返す。
  - **メリット**: 実装がシンプルで、Cloud Run / Cloudflare Workers 双方で同一の応答/障害契約を維持できる。
  - **デメリット**: Upstream 遅延時に LINE WORKS へのレスポンスが遅延する。
  - **採用理由**: Cloud Run の CPU throttling / instance shutdown や Workers との契約対称性を考慮すると、インフラ非依存の確実な転送手段として現時点で最適。

- **(B) Hono `ExecutionContext.waitUntil` を使う Workers 経路**
  - **説明**: Cloudflare Workers の `c.executionCtx.waitUntil(promise)` を利用し、`200` を即時返却した後にバックグラウンド実行。
  - **見送り理由**: Node.js / Cloud Run 環境との応答/障害契約が非対称になるため見送り。

- **(C) Cloud Run Node 経路での Fire-and-Forget**
  - **説明**: Response 返却後に Promise を `await` せずに発火。
  - **見送り理由**: Cloud Run の request-based CPU allocation 設定下において、レスポンス返却直後に CPU が停止・インスタンス終了されるため不採用 ([Cloud Run Container Contract](https://docs.cloud.google.com/run/docs/container-contract))。

- **(D) 共通抽象ヘルパー (runBackground)**
  - **説明**: Workers では `waitUntil`、Cloud Run では fire-and-forget を呼ぶ抽象関数。
  - **見送り理由**: Cloud Run 側での CPU throttling リスクを解消できず、基盤間で失敗時の振る舞いが非対称になるため見送り。

---

## 3. 最終採用構成と処理フロー

### 3.1. シーケンス図

```
[LINE WORKS] ---> (POST /callback) ---> [wmbot (Gateway)]
                                              |
 1. X-WORKS-Signature 検証 (失敗: 401 invalid signature)
 2. X-WORKS-BotId 検証    (欠落: 400 missing bot id / 不一致: 403 bot id mismatch)
 3. Dedup チェック         (重複: 200)
 4. JSON / Zod 検証       (失敗: 400 invalid json / validation error)
 5. await forwardEventToUpstream(rawBody, signature)
      └--> 成功: LINE WORKS へ 200 OK (空 body) 返却
      └--> upstream 5xx / ネットワークエラー:
             dedup key を unregister (手動再投入用)
             logger.error 記録 + 500 返却 (手動再投入用の dedup unregister、公式では再送契約未確認)
```

### 3.2. 今後の拡張 (Durable Queue)

LINE WORKS 公式の非同期化推奨に応えつつ、厳密なイベント非消失・メッセージ到達保証を達成するには、本 Gateway から Cloud Tasks (GCP) や Cloudflare Queues 等の耐久メッセージキュー (Durable Queue) への投入構成が必要となる。これについては別 TODO としてバックログに残し、要件が発生した段階で着手する。
