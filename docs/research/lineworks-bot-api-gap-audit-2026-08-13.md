# LINE WORKS Bot API 差分監査

- 確認日: 2026-08-13
- 対象: LINE WORKS 公式 Bot API と `worksmobile-message-bot` の README / 実装 / テスト
- 目的: 公式 API への追従不足を根拠付きで洗い出し、追従実装と将来 TODO を整理する
- 判定: 2026-08-13 時点で、今回確認した公式 API 差分の追従実装は完了。公式ページで確認できない Callback の自動再送契約は断定しない。

## 結論

メッセージ、添付、Callback、Bot、ドメイン、トークルーム、固定メニュー、リッチメニューの主要経路について、今回の監査で確認した公式仕様への追従を完了した。

1. リッチメニュー画像登録を公式 `fileId` / `i18nFileIds` JSON API（`204 No Content`）へ同期した。
2. ドメイン別 Bot 設定 schema を `visible` / `allowToSelectedMember` へ同期した。
3. Bot 設定の `channelEvents` 8 種と多言語フィールドを公式 schema へ同期した。
4. リッチメニュー全 12 操作と一覧 pagination を実装した。
5. Bot / ドメイン / リッチメニュー一覧の pagination を実装した。
6. 公開 route の HTTP status を公式仕様へ同期した。
7. OAuth scope を `OAUTH_SCOPE` で選択可能にした（未設定時は `bot`）。
8. Callback の `X-WORKS-BotId` 検証と、署名 → Bot ID → dedup → JSON/Zod → upstream 同期 await の処理順を確定した。

## 対応済み差分

### 1. リッチメニュー画像登録（✅ 対応済み）

- 公式: [リッチメニュー登録](https://developers.worksmobile.com/jp/docs/bot-richmenu-create) は、コンテンツアップロードで得た `fileId` を使って画像を登録する手順を示す。
- 公式: [リッチメニュー画像登録](https://developers.worksmobile.com/jp/docs/bot-richmenu-image-set) の request body は JSON の `fileId` / `i18nFileIds` で、成功時は `204 No Content`。
- 対応: `src/services/lineworks/menus/rich.ts` と `src/routes/menus/rich.ts` を JSON body の `fileId` / `i18nFileIds` 方式へ同期し、画像登録を `204` とした。

### 2. ドメイン別 Bot 設定 schema（✅ 対応済み）

- 公式: [ドメインへの Bot 登録](https://developers.worksmobile.com/jp/docs/bot-domain-register) の body は `visible` と `allowToSelectedMember`。
- 対応: `src/services/lineworks/bots-domain.ts` の登録・PUT・PATCH schema を公式フィールドへ同期した。

### 3. Bot 設定 schema（✅ 対応済み）

- 公式: [Bot 登録](https://developers.worksmobile.com/jp/docs/bot-create) は `channelEvents` に `message` / `join` / `leave` / `joined` / `left` / `postback` / `begin` / `end` の 8 種を許可する。多言語項目は `i18nBotNames[].botName`、`i18nDescriptions[].description`、`i18nPhotoUrls[].photoUrl`。
- 対応: `src/services/lineworks/bots-tenant.ts` の `channelEvents`、多言語フィールド、重複・整数制約を公式 schema へ同期した。

### 4. リッチメニューの操作と schema（✅ 対応済み）

- 公式の [Bot API](https://developers.worksmobile.com/jp/docs/bot-api) は、作成・一覧・詳細取得・削除・画像登録・画像取得・ユーザー別適用・ユーザー別取得・ユーザー別削除・デフォルト適用・デフォルト取得・デフォルト削除の 12 操作を提供する。
- 対応: `src/routes/menus/rich.ts` と service 層で全 12 操作、画像の `fileId` / `i18nFileIds`、詳細取得を扱うようにした。

### 5. 一覧 API の pagination（✅ 対応済み）

- 公式: [Bot一覧](https://developers.worksmobile.com/jp/docs/bot-list)、[Botドメイン一覧](https://developers.worksmobile.com/jp/docs/bot-domain-list)、[リッチメニュー一覧](https://developers.worksmobile.com/jp/docs/bot-richmenu-list) は `count` / `cursor` と `responseMetaData.nextCursor` を定義する。
- 対応: Bot、ドメイン、リッチメニューの各一覧で query を upstream へ転送し、`responseMetaData.nextCursor` を保持するようにした。

### 6. 公開 route の HTTP status（✅ 対応済み）

- 公式の作成系 status は、メッセージ送信が `201`（[ユーザー指定メッセージ](https://developers.worksmobile.com/jp/docs/bot-user-message-send)）、トークルーム作成が `201`（[トークルーム登録](https://developers.worksmobile.com/jp/docs/bot-channel-create)）、固定メニュー登録が `201`（[固定メニュー登録](https://developers.worksmobile.com/jp/docs/bot-persistentmenu-create)）、リッチメニュー作成が `201`（[リッチメニュー登録](https://developers.worksmobile.com/jp/docs/bot-richmenu-create)）。リッチメニュー画像登録は `204`、デフォルト適用は `201`。
- 対応: 公開 route と契約テストを公式 status へ同期した。

### 7. OAuth scope（✅ 対応済み）

- 公式: [Bot API](https://developers.worksmobile.com/jp/docs/bot-api) は `bot.message`、`bot`、`bot.read` を提供する。
- 対応: `OAUTH_SCOPE` で `bot.message` / `bot.read` / `bot` を選択可能にし、未設定時は既存互換の `bot` を使うようにした。

### 8. Callback の Bot ID 検証と転送方針（✅ 対応済み / 整理完了）

- 公式 Callback ページ（[Callback](https://developers.worksmobile.com/jp/docs/bot-callback)）に沿って `X-WORKS-Signature` と `X-WORKS-BotId` を検証する。Bot ID 欠落は `400`、不一致は `403`。
- 現行順序は **署名検証 → Bot ID 検証 → dedup → JSON/Zod 検証 → upstream 同期 await 転送**。転送失敗時は `500` とログ出力を行い、dedup key を `unregister` する。
- 公式 Callback ページでは自動再送契約を確認できないため、`500` を LINE WORKS の自動再送の根拠とはしない。`unregister` は手動再投入・再処理用であり、厳密な非消失は Durable Queue の将来 TODO とする。

## 現行方針を維持するもの

- Callback の 8 event type は公式記載と一致する。公式仕様変更で type が追加された場合だけ追従する（未知 type は現状 `400`）。
- 添付ダウンロードは公式の 3xx `Location` 応答に合わせ、manual redirect で実 URL を抽出する。
- 固定メニューの action type は `message` / `uri` / `copy` を扱う。リッチメニュー登録時に固定メニューが削除される公式制約は運用上の注意として維持する。

## 残る将来 TODO

1. **Durable Queue による非消失保証** — 転送先障害時にもイベントを確実に滞留・再処理する要件が生じた場合に導入を検討する。
2. **共有ストアによる厳密 dedup** — Workers isolate 間 / Cloud Run instance 間で dedup を共有する要件が生じた場合に導入を検討する。
3. **ローカル callback handler の責務整理** — 本サーバ内応答と upstream 転送の責務境界を、実装要件が生じた時点で決める。
4. **将来の message type 追従** — LINE WORKS に新しい message type が追加された場合に `messageSchemas` へ追加する。
5. **将来の callback event type 追従** — LINE WORKS に新しい callback event type が追加された場合に schema の union へ追加する。
