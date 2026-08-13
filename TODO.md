# worksmobile-message-bot 実装 TODO

LINE WORKS Bot の Webhook サーバー（Bun + TypeScript + Hono）。IFTTT / Make から Webhook 経由でメッセージ送信・添付・トークルーム / Bot CRUD を行う薄いラッパ。

> 完了済の整備履歴は [CHANGELOG.md](./CHANGELOG.md) と `git log` を参照。本ファイルは **進行中・未着手のみ**。
> 専用 issue tracker は未使用。機能の SoT は [`README.md`](./README.md)（エンドポイント仕様）、設計判断は [`docs/adr/`](./docs/adr/)、用語集は [`CONTEXT.md`](./CONTEXT.md)。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

---

## 未着手 / 要件待ち

### 信頼性・スケーリング

- [ ] **Durable Queue による非消失キューイング** — 現行は Cloud Run / Workers 共通で同期 await 転送、失敗時 500 + ログ出力とし、`unregister` は手動再投入用。転送先障害時にもイベントを確実に滞留・再処理する厳密な非消失保証が必要になった場合に Durable Queue を検討する（[調査メモ](./docs/research/lineworks-callback-bot-id-async-2026-08-13.md)）。
- [ ] **dedup を共有ストア化** — Workers isolate 間や Cloud Run instance 間で wmbot 内 Map は共有されない。gateway 単体で厳密な一回処理が必要になった時だけ共有ストアまたは upstream 側 idempotency を導入する（`callback/dedup.ts`、[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。

### コードの整理・設計境界

- [ ] **ローカル callback handler の責務を決める** — 現行 callback は設定済み upstream への転送（[ADR-0005](./docs/adr/0005-forward-callback-to-upstream.md)）を主経路とする一方、本サーバ内応答の将来余地もある。削除せず、実装する要件が出た時に forward との責務境界を決める。

### 拡張余地（必要になったら）

- [ ] **メッセージ型の追加** — 新しい LINE WORKS メッセージ型が必要になったら `services/lineworks/messages/index.ts` の `messageSchemas` に Zod schema を 1 件足すだけ（route とディスパッチャは自動追従、[ADR-0007](./docs/adr/0007-message-type-dispatcher.md)）。
- [ ] **新 callback event type への追従** — LINE WORKS 仕様変更で event type が増えたら `callback/schemas.ts` の `discriminatedUnion` に追加する（未知 type は現状 400 で reject）。

### ワークフロー（任意）

- [ ] **AFK-agent ワークフローの有効化** — issue → triage → PRD → 実装 を回したくなったら `setup-matt-pocock-skills` を再実行し、issue tracker = GitHub Issues を選んで `docs/agents/issue-tracker.md` + triage-labels を再生成する（[`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)）。

---

## 参考

- エンドポイント仕様: [`README.md`](./README.md)
- 設計判断（ADR）: [`docs/adr/`](./docs/adr/)
- 用語集: [`CONTEXT.md`](./CONTEXT.md)
- 運用ゴッチャ: [`CLAUDE.md`](./CLAUDE.md)
