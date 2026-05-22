# worksmobile-message-bot

LINE WORKS Bot の Webhook サーバー（Bun + TypeScript + Hono）の技術用語集。
ここは **glossary であって他の何物でもない** — 実装詳細・設計判断は持たない（エンドポイント仕様は [`README.md`](./README.md)、設計決定は [`docs/adr/`](./docs/adr/)、運用ゴッチャは [`CLAUDE.md`](./CLAUDE.md)）。

## Language

### 送信 (outbound)

**Bot API**:
LINE WORKS が提供する Bot 用 REST API（メッセージ送信・添付・トークルーム / メンバー / Bot CRUD 等）。本サーバはこれの薄いラッパ。
_Avoid_: LINE WORKS API（広すぎる）, messaging API

**MessageTarget**:
メッセージ送信先を表す共有型 `{ channelId } | { userId }`。**channelId か userId の片方だけ**を持つ（両方は不可）。`messages/index.ts` の `buildMessageUrl` がこれを受けて URL を組む。
_Avoid_: recipient, destination, channel（channelId 側だけを指す語）

**メッセージ型 (message type)**:
`text` / `image` / `flex` 等の送信メッセージ種別。`services/lineworks/messages/index.ts` の `messageSchemas` マップ（type → Zod schema）が SoT で、汎用 `sendMessageByType` が `{ type, ...body }` を組み立てて送る。型ごとの個別 sender 関数は書かない。
_Avoid_: message kind, テンプレート（一部 type の呼称に過ぎない）

**server token**:
Bot API 呼び出しに使うアクセストークン。`services/lineworks/auth.ts` の `getServerToken` が JWT（RS256）→ トークン取得を 1 関数で行い、**キャッシュ + single-flight** で重複取得を抑える。route 層は `tokenMiddleware` 経由で `c.var.token` から受け取る。
_Avoid_: access token（曖昧）, JWT（トークンを取る手段であって token 本体ではない）

**添付 (attachment)**:
Bot メッセージに添付するファイル。アップロード（2 段階: uploadUrl 発行 → multipart POST）とダウンロード（3xx の `Location` 抽出）の両方を `services/lineworks/attachment.ts` が担う。
_Avoid_: file（汎用すぎる）, media, upload（操作名であって対象名ではない）

### 受信 (inbound)

**callback**:
LINE WORKS から Bot 宛に届く Webhook イベント（`message` / `postback` / `join` / `leave` 等）。BASIC 認証ではなく **`X-WORKS-Signature`（raw body の HMAC-SHA256）** で真正性を検証する。
_Avoid_: webhook（本サーバ全体が webhook サーバなので曖昧）, event（callback の中身を指す語）

**dedup**:
callback の再送による副作用二重実行を防ぐ仕組み。**raw body の SHA-256** を key に、直近 **5 分 window** の重複を in-memory Map で検出する（`callback/dedup.ts`）。
_Avoid_: idempotency（より広い概念）, 重複排除（口語）

**forward (転送)**:
検証を通った callback を、raw body + 署名のまま **501（scheduler-501）の `/callback`** へ素通し転送すること（`callback/forward.ts`、env `FORWARD_501_CALLBACK_URL`）。応答コマンドの判断は 501 側にあり、本サーバは gateway に徹する。
_Avoid_: relay, proxy（HTTP proxy と紛らわしい）, dispatch（ローカル handler 雛形の語）

## Flagged ambiguities

- **callback vs event**: 受信単位の HTTP リクエストが「callback」、その body 内の 1 件（`type` を持つ discriminated union 要素）が「event」。両者を混ぜない。
- **forward vs dispatch**: 現行は forward（501 へ転送）に一本化。`callback/{dispatch,handlers,reply}.ts` のローカル handler 雛形は残置だが**呼ばれない**（[ADR-0005](./docs/adr/0005-forward-callback-to-501.md)）。「dispatch」はその雛形に閉じた語で、現行フローには使わない。

## 用語が会話で交わる例

> dev A: 「新しいメッセージ型を足したいんだけど、route も書くの？」
> dev B: 「いや、`messageSchemas` に **メッセージ型** の Zod schema を 1 件足すだけ。`routes/messages.ts` のループが `(channels|users)/:id/messages/type/<type>` を自動登録して、`sendMessageByType` が組み立てて送る。個別 sender は書かない。」
> dev A: 「送信先はハンドラで `getServerToken` 呼べばいい？」
> dev B: 「**server token** は `tokenMiddleware` が `c.var.token` に入れてくれるからハンドラでは呼ばない。送信先は **MessageTarget** を組んで渡すだけ。channelId か userId の片方ね。」
