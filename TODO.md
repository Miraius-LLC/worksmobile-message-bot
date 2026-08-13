# worksmobile-message-bot 実装 TODO

LINE WORKS Bot の Webhook サーバー（Bun + TypeScript + Hono）。IFTTT / Make から Webhook 経由でメッセージ送信・添付・トークルーム / Bot CRUD を行う薄いラッパ。

> 完了済の整備履歴は [CHANGELOG.md](./CHANGELOG.md) と `git log` を参照。本ファイルは **進行中・未着手のみ**。
> 専用 issue tracker は未使用。機能の SoT は [`README.md`](./README.md)（エンドポイント仕様）、設計判断は [`docs/adr/`](./docs/adr/)、用語集は [`CONTEXT.md`](./CONTEXT.md)。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

---

## 未着手 / backlog

### 公式API追従

- [x] **リッチメニュー画像登録を公式仕様へ同期** — 公式の `fileId` JSON API、画像upload flow、204 responseを現行wrapperへ反映し、契約テストを追加した（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- [x] **ドメイン別Bot設定schemaを公式仕様へ同期** — `visible` / `allowToSelectedMember` とPUT/PATCHの公式schemaへ更新し、旧administrators系schemaを除去した（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- [x] **Bot CRUDのchannelEvents・i18n schemaを公式仕様へ同期** — `message` / `postback`を含む8 channel event、i18nの公式field名、unique/integer制約を反映した（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- [x] **リッチメニューの未対応操作を追加** — 詳細・画像取得、ユーザー別適用/取得/削除、デフォルト取得/削除を追加する（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- [x] **Bot・ドメイン・リッチメニュー一覧のpaginationを追加** — `count` / `cursor` / `responseMetaData.nextCursor`を公式仕様どおり扱い、転送・クエリ検証・契約テストを反映した（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- [x] **公開routeのHTTP status契約を公式準拠へ整理** — 201/204を返す作成・画像・デフォルト適用経路について、既存利用者互換を確認して契約テストを固定する（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- [ ] **OAuth scopeの用途別選択を設計** — `bot.message` / `bot` / `bot.read`をAPI用途と最小権限に応じて選択可能にする（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。
- [ ] **CallbackのBot ID検証と非同期処理方針を確認** — 公式Callbackの `X-WORKS-BotId` ヘッダ検証と、後続イベントを滞留させない非同期転送を採用するか要件を確認する（[監査メモ](./docs/research/lineworks-bot-api-gap-audit-2026-08-13.md)）。

### スケーリング

- [ ] **dedupを共有ストア化** — Workers isolate間やCloud Run instance間でwmbot内Mapは共有されない。gateway単体で厳密な一回処理が必要になった時だけ共有ストアまたはupstream側idempotencyを導入する（`callback/dedup.ts`、[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。

### コードの整理

- [ ] **ローカルcallback handlerの責務を決める** — 現行callbackは設定済みupstreamへの転送（[ADR-0005](./docs/adr/0005-forward-callback-to-upstream.md)）を主経路とする一方、公式Callbackに沿った本サーバ内応答の将来余地もある。削除せず、実装する要件が出た時にforwardとの責務境界を決める。

### 拡張余地（必要になったら）

- [ ] **メッセージ型の追加** — 新しい LINE WORKS メッセージ型が必要になったら `services/lineworks/messages/index.ts` の `messageSchemas` に Zod schema を 1 件足すだけ（route とディスパッチャは自動追従、[ADR-0007](./docs/adr/0007-message-type-dispatcher.md)）。
- [ ] **新 callback event type への追従** — LINE WORKS 仕様変更で event type が増えたら `callback/schemas.ts` の `discriminatedUnion` に追加する（未知 type は現状 400 で reject）。
- [ ] **アクセストークンの追加スコープ** — 現状 scope は `bot` 固定。用途別の最小権限選択は上記の「OAuth scopeの用途別選択」で設計する。

### ワークフロー（任意）

- [ ] **AFK-agent ワークフローの有効化** — issue → triage → PRD → 実装 を回したくなったら `setup-matt-pocock-skills` を再実行し、issue tracker = GitHub Issues を選んで `docs/agents/issue-tracker.md` + triage-labels を再生成する（[`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)）。

---

## 参考

- エンドポイント仕様: [`README.md`](./README.md)
- 設計判断（ADR）: [`docs/adr/`](./docs/adr/)
- 用語集: [`CONTEXT.md`](./CONTEXT.md)
- 運用ゴッチャ: [`CLAUDE.md`](./CLAUDE.md)
