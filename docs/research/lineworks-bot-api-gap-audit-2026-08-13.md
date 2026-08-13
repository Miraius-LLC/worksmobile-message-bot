# LINE WORKS Bot API 差分監査

- 確認日: 2026-08-13
- 対象: LINE WORKS 公式 Bot API と `worksmobile-message-bot` の README / 実装 / テスト
- 目的: 公式APIへの追従不足だけを根拠付きでTODO化する
- 判定: 「未実装」と「仕様不一致」を分け、公式仕様から確認できないものはTODO化しない

## 結論

現行実装はメッセージ、添付、Callback、Bot、ドメイン、トークルーム、固定メニュー、リッチメニューの主要経路を広く持つ。一方、公式Bot APIとの完全な薄いラッパーとしては、次の差分が確認できた。

1. リッチメニュー画像登録のリクエスト形式が公式仕様と異なる。
2. ドメイン別Bot設定のbody schemaが公式仕様と異なる。
3. Bot設定の `channelEvents` と多言語フィールドが公式schemaと一致していない。
4. リッチメニューの詳細・画像・ユーザー別・デフォルト操作と一覧paginationが不足している。
5. Bot / ドメイン一覧のpaginationが不足している。
6. 一部の公開routeが、公式の作成系HTTP statusをそのまま返していない。
7. Access Token scopeを `bot` に固定しており、公式の `bot.message` / `bot.read` を使い分けていない。

Callbackは公式記載の8 event typeを実装している。公式ページはevent typeが将来追加される可能性を明記しているため、未知typeを安全側にrejectする現行方針は維持し、仕様変更時に追従するTODOだけを残す。

## 確認済み差分

### 1. リッチメニュー画像登録の形式差異（優先度: 高）

- 公式: [リッチメニュー登録](https://developers.worksmobile.com/jp/docs/bot-richmenu-create) は、コンテンツアップロードで得た `fileId` を使って画像を登録する手順を示す。
- 公式: [リッチメニュー画像登録](https://developers.worksmobile.com/jp/docs/bot-richmenu-image-set) の request body は JSON の `fileId` / `i18nFileIds` で、成功時は `204 No Content`。
- 現行: `src/services/lineworks/menus/rich.ts` の `uploadRichMenuImage` は `multipart/form-data` の `file` を送る。`src/routes/menus/rich.ts` も画像ファイルを受け取り、200 + `{ richmenuId }` を返す。
- 判定: 公式APIへ転送する薄いラッパーとして、実際に公式仕様と一致しているかを修正・実測で確定する必要がある。

### 2. ドメイン別Bot設定のschema差異（優先度: 高）

- 公式: [ドメインへのBot登録](https://developers.worksmobile.com/jp/docs/bot-domain-register) の body は `visible` と `allowToSelectedMember`。
- 現行: `src/services/lineworks/bots-domain.ts` の `botDomainSchema` は `administrators` を必須とし、`enableCallback` / `enableGroupJoin` などを受ける。公式bodyとの一致が確認できず、`.loose()` で余分なフィールドも許容している。
- 判定: 公式schemaに合わせた再設計が必要。PUT/PATCHの仕様も各公式ページで確認してから共通schemaを決める。

### 3. Bot設定のschema差異（優先度: 高）

- 公式: [Bot登録](https://developers.worksmobile.com/jp/docs/bot-create) と [Bot取得](https://developers.worksmobile.com/jp/docs/bot-get) は `channelEvents` に `message` / `join` / `leave` / `joined` / `left` / `postback` / `begin` / `end` の8種を許可する。
- 現行: `src/services/lineworks/bots-tenant.ts` の `channelEventTypeSchema` は `join` / `leave` / `joined` / `left` / `begin` / `end` の6種で、`message` と `postback` を送れない。
- 公式: 多言語項目は `i18nBotNames[].botName`、`i18nDescriptions[].description`、`i18nPhotoUrls[].photoUrl`。
- 現行: 共通の `i18nValueSchema` が `value` キーを使用しており、公式のfield名と一致しない。
- 判定: Bot CRUDのrequest/response schemaとテストを公式field名に合わせて再監査する。

### 4. リッチメニューの未対応操作とschema（優先度: 高〜中）

- 公式のBot API一覧は、作成・一覧・詳細取得・削除・画像登録・画像取得・ユーザー別適用・ユーザー別取得・ユーザー別削除・デフォルト適用・デフォルト取得・デフォルト削除を提供する（[Bot API](https://developers.worksmobile.com/jp/docs/bot-api)）。
- 現行の `src/routes/menus/rich.ts` は作成・一覧・画像登録・デフォルト適用・削除の5経路のみ。
- 公式の [リッチメニュー一覧](https://developers.worksmobile.com/jp/docs/bot-richmenu-list) は `count` / `cursor` と `responseMetaData.nextCursor` を持つ。現行 `listRichMenus` はqueryを受けず、metadataも返さない。
- 公式の [リッチメニュー取得](https://developers.worksmobile.com/jp/docs/bot-richmenu-get) では詳細schemaに多言語action fieldsも含まれる。現行の `richMenuCreateSchema` は `areas` の最大20件を検証せず、多言語fieldsも受けない。
- 公式: [ユーザー別適用](https://developers.worksmobile.com/jp/docs/bot-richmenu-user-set)、[取得](https://developers.worksmobile.com/jp/docs/bot-richmenu-user-get)、[削除](https://developers.worksmobile.com/jp/docs/bot-richmenu-user-delete)、[デフォルト取得](https://developers.worksmobile.com/jp/docs/bot-default-richmenu-get)、[デフォルト削除](https://developers.worksmobile.com/jp/docs/bot-default-richmenu-delete)。現行には対応route/serviceがない。

### 5. 一覧APIのpagination（優先度: 中）

- 公式: [Bot一覧](https://developers.worksmobile.com/jp/docs/bot-list)、[Botドメイン一覧](https://developers.worksmobile.com/jp/docs/bot-domain-list)、[Bot利用ユーザー一覧](https://developers.worksmobile.com/jp/docs/bot-domain-member-list)、[トークルームメンバー一覧](https://developers.worksmobile.com/jp/docs/bot-channel-member-list)、[リッチメニュー一覧](https://developers.worksmobile.com/jp/docs/bot-richmenu-list) は `count` / `cursor` と `responseMetaData.nextCursor` を定義する。
- 現行はドメイン利用ユーザーとトークルームメンバーではpaginationを扱うが、Bot一覧・ドメイン一覧・リッチメニュー一覧では未対応またはmetadataを破棄している。
- 判定: 対象一覧を同じpagination contractへ揃えるTODOが妥当。

### 6. 公式HTTP statusとの公開route差異（優先度: 中）

- 公式の作成系statusは、メッセージ送信が201（[ユーザー指定メッセージ](https://developers.worksmobile.com/jp/docs/bot-user-message-send)）、トークルーム作成が201（[トークルーム登録](https://developers.worksmobile.com/jp/docs/bot-channel-create)）、固定メニュー登録が201（[固定メニュー登録](https://developers.worksmobile.com/jp/docs/bot-persistentmenu-create)）、リッチメニュー作成が201（[リッチメニュー登録](https://developers.worksmobile.com/jp/docs/bot-richmenu-create)）。
- 公式のリッチメニュー画像登録は204、デフォルト適用は201。
- 現行 `src/routes/messages.ts`、`src/routes/channels.ts`、`src/routes/menus/persistent.ts`、`src/routes/menus/rich.ts` は一部を200で返している。
- 判定: ラッパーの公開契約を公式statusへ合わせるか、既存利用者互換を優先するかを決めてから実装する。即時変更ではなく、契約テスト込みのTODOとする。

### 7. scopeの固定（優先度: 中）

- 公式: [Bot API](https://developers.worksmobile.com/jp/docs/bot-api) は `bot.message`、`bot`、`bot.read` を提供し、メッセージ・メニュー・トークルームには `bot.message`、読み取りには `bot.read`、Bot管理には `bot` を使い分ける。
- 現行: `src/services/lineworks/auth.ts` はOAuth requestの `scope` を常に `bot` としている。
- 判定: 現行機能が動く可能性はあるが、最小権限とread-only tokenの選択肢をwrapperとして提供できていない。scopeの設定方式をTODO化する価値がある。

## 現行方針を維持するもの

- Callbackの8 event type: [Callback](https://developers.worksmobile.com/jp/docs/bot-callback) に記載された8種と一致する。公式は将来追加の可能性を記載しているため、未知type rejectと追従TODOを維持する。
- 添付ダウンロード: 公式は302 Locationを返す（[コンテンツ取得](https://developers.worksmobile.com/jp/docs/bot-attachment-get)）。現行のmanual redirect + Location抽出は方向性が一致する。
- 固定メニューのaction type: 公式はmessage / uri / copyを定義し、現行schemaもこの3種を扱っている。ただし、リッチメニュー登録時は固定メニューが削除されるという公式制約（[固定メニュー登録](https://developers.worksmobile.com/jp/docs/bot-persistentmenu-create)）は運用文書に明記した方がよい。

## 監査から作るTODO候補

1. リッチメニュー画像登録を公式のfileId JSON APIへ合わせ、upload flowとresponse statusを契約テストで固定する。
2. ドメイン別Bot設定schemaを公式のvisible / allowToSelectedMemberへ合わせ、PUT/PATCHの公式schemaも追加確認する。
3. Bot CRUDのchannelEvents・i18n fields・unique/integer制約を公式schemaへ合わせる。
4. リッチメニューの未対応6操作と詳細schema、多言語fields、一覧paginationを追加する。
5. Bot一覧・ドメイン一覧・リッチメニュー一覧のpaginationを追加する。
6. 公開routeのHTTP statusを公式準拠にするか、既存利用者互換を含めて契約を決定する。
7. scopeをAPI用途別に選択可能にし、デフォルトを最小権限にする設計を決める。
8. Callbackの `X-WORKS-BotId` 検証と、公式の非同期処理推奨を採用するか要件確認する（未確認のため保留）。
