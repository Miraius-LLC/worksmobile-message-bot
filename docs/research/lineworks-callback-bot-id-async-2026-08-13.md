# LINE WORKS Callback の Bot ID 検証および非同期処理方針の調査報告

## 主要結論 (TL;DR)

1. **LINE WORKS 公式仕様の真実 (一次情報)**
   - LINE WORKS の Callback は **「送信に失敗しても再送されない」** 仕様である ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。
   - 公式ドキュメントでは、後続イベントの処理遅延を防ぐために **「イベント処理の非同期化」** が明確に推奨されている ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。
   - リクエストヘッダーには `X-WORKS-BotId` (受信対象 Bot の識別子) が含まれ、HTTP ヘッダー名の規格通り大文字小文字は区別されない (`case-insensitive`) ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。

2. **現行コードの誤った契約前提と差分**
   - **再送前提の破綻**: 現行コード ([`src/routes/callback.ts`:L67-L74](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/routes/callback.ts#L67-L74), [`src/services/lineworks/callback/forward.ts`:L11-L17](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/services/lineworks/callback/forward.ts#L11-L17)) や ADR ([`docs/adr/0004-callback-dedup-in-memory-5min.md`:L28](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/docs/adr/0004-callback-dedup-in-memory-5min.md#L28))、README ([`README.md`:L908-L909](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/README.md#L908-L909)) は「upstream が 5xx の場合に 500 を返し dedup を解除して LINE WORKS からの再送を受け入れる」設計となっているが、**LINE WORKS は再送しないためこの契約は無効**である。
   - **同期 await 転送**: 現行コード ([`src/routes/callback.ts`:L68](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/routes/callback.ts#L68)) は転送処理を同期 `await` しており、公式の「非同期化推奨」に反している。
   - **Bot ID 非検証**: 現行コード ([`src/routes/callback.ts`:L30](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/routes/callback.ts#L30)) は `X-WORKS-Signature` のみを取得・検証しており、`X-WORKS-BotId` を完全に無視している。

3. **推奨案 (選択肢 D: 共通抽象による 200 先行 + バックグラウンド非同期処理)**
   - **200 先行返却**: 署名検証 + Bot ID 検証 + (必要に応じて) Payload バリデーション成功直後、転送結果を待たずに直ちに `200 OK` (空 body) を LINE WORKS へ返却する。
   - **Bot ID 検証の実装**: `c.req.header('x-works-botid')` を取得し、設定値 (`config().botId`) と比較する。不一致時は `400 Bad Request` で即座に拒否し、`logger.warn` で期待値・実値を構造化ログ出力する。
   - **デュアル環境対応**: Cloudflare Workers 向けには `c.executionCtx.waitUntil()` を活用し、Cloud Run 向けには `Promise` のバックグラウンド発火 (fire-and-forget + エラーハンドリング) を包む共通抽象関数を用意する。

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
- **失敗時再送の非存在**: 「Callback で送信された HTTP リクエストは、**送信に失敗しても再送されません**」と明記されている ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。

### 1.4. イベント処理の非同期化推奨
- **公式記載**: 「HTTPS POST リクエストの処理が後続のイベントの処理に遅延を与えないよう、**イベント処理を非同期化することを推奨します**」と明確に記載されている ([LINE WORKS Callback 公式ドキュメント](https://developers.worksmobile.com/jp/docs/bot-callback))。

---

## 2. 現行コードの契約と差分整理 (行番号付き)

### 2.1. 該当ファイルと行番号一覧

1. **`src/routes/callback.ts`**
   - [`L30`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/routes/callback.ts#L30): `const signature = c.req.header('x-works-signature')` のみ取得し、`X-WORKS-BotId` は取得・検証していない。
   - [`L68-L74`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/routes/callback.ts#L68-L74): `await forwardEventToUpstream(rawBody, signature)` を同期的に待機。例外時に `unregister(dedupKey)` して `throw error` (`app.onError` 経由で 500 返却) している。

2. **`src/services/lineworks/callback/verify.ts`**
   - [`L12-L26`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/services/lineworks/callback/verify.ts#L12-L26): 署名検証ロジック (`verifyCallbackSignature`) は実装されているが、Bot ID 検証ロジックは存在しない。

3. **`src/services/lineworks/callback/forward.ts`**
   - [`L11-L17`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/services/lineworks/callback/forward.ts#L11-L17), [`L39-L47`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/services/lineworks/callback/forward.ts#L39-L47): コメントおよび実装において「upstream 5xx 時に throw して LINE WORKS の再送を促す」設計となっている。

4. **`src/services/lineworks/callback/dedup.ts`**
   - [`L44-L53`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/services/lineworks/callback/dedup.ts#L44-L53): `unregister(key)` を「副作用失敗時に LINE WORKS の再送を受け入れられるようロールバックする」目的で提供している。

5. **`src/services/lineworks/callback/dispatch.ts`**
   - [`L17-L40`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/services/lineworks/callback/dispatch.ts#L17-L40): ローカルイベント処理関数。同期的に `await` される構成になっている。

6. **`src/worker.ts` & `src/app.ts`**
   - [`src/worker.ts`:L9-L12](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/worker.ts#L9-L12): `ExecutionContext` (`ctx`) を受けているが `callbackApp` に渡していない。
   - [`src/app.ts`:L29](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/app.ts#L29), [`L81`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/src/app.ts#L81): `/callback` を PUBLIC_PATHS として BASIC 認証除外マウントしている。

7. **`tests/routes/callback.test.ts`**
   - [`L161-L167`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/tests/routes/callback.test.ts#L161-L167): `upstreamが5xxを返すと500（再送を促す）` テスト。
   - [`L247-L261`](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/tests/routes/callback.test.ts#L247-L261): `転送が throw した場合は dedup を unregister して再送を許可する` テスト。

8. **ADR & README**
   - [`docs/adr/0004-callback-dedup-in-memory-5min.md`:L28](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/docs/adr/0004-callback-dedup-in-memory-5min.md#L28): 「転送に失敗した場合はkeyを解除し、LINE WORKSからの再送を許可する」
   - [`docs/adr/0005-forward-callback-to-upstream.md`:L34](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/docs/adr/0005-forward-callback-to-upstream.md#L34): 「転送先障害時の再送とidempotencyを両サービスで考慮する必要がある」
   - [`README.md`:L908-L909](file:///Users/fujimogn/Develop/worksmobile-message-bot/.claude/worktrees/callback-research-ar/README.md#L908-L909): 「upstreamへの転送が5xxまたはnetwork errorで失敗した場合はdedup keyをunregisterし、LINE WORKSからの再送を許可する」

### 2.2. 契約と差分のまとめ表

| 項目 | LINE WORKS 公式仕様 ([公式 doc](https://developers.worksmobile.com/jp/docs/bot-callback)) | 現行実装 / ドキュメント | 差分・課題 |
| :--- | :--- | :--- | :--- |
| **再送仕様** | **送信失敗時も再送されない** | 5xx 時に 500 を返し、`unregister` して LINE WORKS の再送を待つ契約 | 根本的誤り。LINE WORKS は再送しないため 500 応答・`unregister` は無意味 |
| **処理方式** | **非同期化を推奨** | 同期 `await forwardEventToUpstream(...)` | 公式推奨に非適合。Upstream 遅延で LINE WORKS レスポンスが遅延 |
| **Bot ID 検証** | `X-WORKS-BotId` ヘッダーを送信 | ヘッダーの存在自体を完全無視 | 不正な Bot ID 宛てのリクエストを検知・拒否できない |

---

## 3. 非同期化の選択肢比較

### 3.1. 4 つの選択肢

- **(A) 現状の await 転送 (現行維持)**
  - **説明**: HTTP リクエストハンドラ内で `await forwardEventToUpstream()` の完了を待ってから `200` を返す。
  - **メリット**: 実装がシンプルで、プラットフォーム間の挙動差がない。
  - **デメリット**: 公式の「非同期化推奨」に反する。Upstream のレスポンス速度に引きずられ、LINE WORKS 側でタイムアウトや後続イベント遅延が発生する。誤った「再送前提」に依存。

- **(B) Hono `ExecutionContext.waitUntil` を使う Workers 経路**
  - **説明**: Cloudflare Workers の `c.executionCtx.waitUntil(promise)` を利用し、レスポンス `200` を即時返却した後にバックグラウンドで転送処理を実行。
  - **メリット**: Cloudflare Workers 上でリクエスト終了後もプロセスが中断されず、安全にバックグラウンド実行を完託できる。
  - **デメリット**: Node.js / Cloud Run 環境には `c.executionCtx` が存在しないため、単体ではデュアルデプロイに対応できない。

- **(C) Cloud Run Node 経路**
  - **説明**: Node.js / Bun (Cloud Run) 上で、レスポンス返却後に `forwardEventToUpstream()` の Promise を `await` せずに発火 (fire-and-forget + `.catch()` でエラーログ)。
  - **メリット**: Node.js 環境で即座に `200` を返却できる。
  - **注意点/リスク**: Cloud Run の CPU 割り当て設定が「リクエスト処理中のみ CPU を割り当てる」場合、レスポンス返却直後に CPU が抑制され、バックグラウンド処理が途中で停止・極端に遅延するリスクがある。

- **(D) 共通抽象 (推奨案)**
  - **説明**: `c.executionCtx?.waitUntil` の存在チェックを行い、Workers では `waitUntil` を使用、Node.js (Cloud Run) ではエラーハンドリング付き Promise 発火を行う共通ヘルパー関数 `runBackground(c, promise)` を導入。
  - **メリット**: 同一コードで Workers と Cloud Run の双方に対応可能。200 先行返却と公式非同期化推奨を完全達成。

### 3.2. 200 先行返却 (200 OK Early Return) による契約の変化

1. **エラー応答の遮断**: LINE WORKS には検証成功時点で即座に `200 OK` を返すため、Upstream 転送時の 5xx やネットワークエラーは LINE WORKS へのレスポンスステータスに影響を与えない。
2. **`unregister` (Dedup キャンセル) の廃止**: LINE WORKS から再送が来ないため、転送失敗時に `unregister` して再送を許可する処理は不要。Dedup は純粋な短時間重複抑止 (best-effort) としてのみ機能させる。
3. **エラーハンドリングの移行**: Upstream 転送失敗は LINE WORKS への HTTP 500 レスポンスではなく、自 Gateway の構造化エラーログ (`logger.error`) および将来のアラート/リトライキューでハンドリングする。

---

## 4. 推奨案と運用要件

### 4.1. Bot ID 検証の提案

- **実装要否**: **実装すべき**。
- **検証ロジック**:
  1. 受信ヘッダー `c.req.header('x-works-botid')` を取得。
  2. 設定値 `config().botId` が存在する場合、両者を比較。
  3. **不一致時の挙動**: `400 Bad Request` (または `403 Forbidden`) を返し、処理を中断する。
  4. **ログ出力**: 不一致時は `logger.warn('Callback の Bot ID 検証に失敗', { caller, debug: { expected: config().botId, actual: headerBotId } })` を記録する。

### 4.2. ステータス / エラー契約の定義

```
[LINE WORKS] ---> (POST /callback) ---> [wmbot (Gateway)]
                                              |
 1. X-WORKS-Signature 検証 (失敗: 401)          |
 2. X-WORKS-BotId 検証    (失敗: 400)          |
 3. Dedup チェック         (重複: 200)          |
 4. JSON / Zod 検証       (失敗: 400)          |
                                              v
LINE WORKS へ 200 OK (空 body) 返却  <--- [WMbot 即時 200]
                                              |
                                     (runBackground 非同期)
                                              v
                                  [Upstream 転送 / Dispatch]
                                    (失敗時: logger.error 記録)
```

### 4.3. 運用要件および未確定事項 (明示的整理)

1. **Cloud Run の CPU 割り当てポリシー (運用要件)**
   - **要件**: Cloud Run にデプロイする場合、200 先行返却後のバックグラウンド転送処理を確実に完結させるため、コンテナの CPU 割り当てを **「CPU を常に割り当てる (CPU is always allocated)」** (`--no-cpu-throttling`) に設定する必要がある。
2. **Upstream 転送失敗時の到達保証・再送運用 (未確定要件)**
   - **現状**: LINE WORKS が再送を行わないため、Gateway $\rightarrow$ Upstream の転送が失敗した場合、イベントは消失する。
   - **運用要件提案**: 厳密なメッセージ非消失が必要な場合は、Gateway 内での Retry キュー (Cloud Tasks / Redis / In-memory Retry) または DLQ (Dead Letter Queue) の構築を別タスクとして検討・要件定義する必要がある。
3. **複数 Bot (マルチテナント) 受信対応の要件 (未確定要件)**
   - **現状**: `config().botId` の単一 Bot 前提。
   - **要件**: 1 つの Gateway で複数 Bot の Callback を受信する拡張を行う場合は、`X-WORKS-BotId` に応じて動的に Bot Secret や Upstream URL を切り替える設計変更が必要となる。
