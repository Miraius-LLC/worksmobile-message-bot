# worksmobile-message-bot 実装 TODO

LINE WORKS Bot の Webhook サーバー（Bun + TypeScript + Hono）。IFTTT / Make から Webhook 経由でメッセージ送信・添付・トークルーム / Bot CRUD を行う薄いラッパ。

> 完了済の整備履歴は [CHANGELOG.md](./CHANGELOG.md) と `git log` を参照。本ファイルは **進行中・未着手のみ**。
> 「必要になったら足す」型の拡張手順（メッセージ型追加 = [`.claude/rules/services.md`](./.claude/rules/services.md)、callback event type 追従 = [`README.md`](./README.md) の callback 節、AFK-agent ワークフロー有効化 = [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)）は TODO ではなく各文書に置く。
> 専用 issue tracker は未使用。機能の SoT は [`README.md`](./README.md)（エンドポイント仕様）、設計判断は [`docs/adr/`](./docs/adr/)、用語集は [`CONTEXT.md`](./CONTEXT.md)。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

---

## 未着手 / 要件待ち

### 信頼性・スケーリング

- [ ] **Durable Queue による非消失キューイング** — 現行は Cloud Run / Workers 共通で同期 await 転送、失敗時 500 + ログ出力とし、`unregister` は手動再投入用。転送先障害時にもイベントを確実に滞留・再処理する厳密な非消失保証が必要になった場合に Durable Queue を検討する（[調査メモ](./docs/research/lineworks-callback-bot-id-async-2026-08-13.md)）。
- [ ] **dedup を共有ストア化** — Workers isolate 間や Cloud Run instance 間で wmbot 内 Map は共有されない。gateway 単体で厳密な一回処理が必要になった時だけ共有ストアまたは upstream 側 idempotency を導入する（`callback/dedup.ts`、[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。

---

## 参考

- エンドポイント仕様: [`README.md`](./README.md)
- 設計判断（ADR）: [`docs/adr/`](./docs/adr/)
- 用語集: [`CONTEXT.md`](./CONTEXT.md)
- 運用ゴッチャ: [`CLAUDE.md`](./CLAUDE.md)
