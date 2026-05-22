# worksmobile-message-bot 実装 TODO

LINE WORKS Bot の Webhook サーバー（Bun + TypeScript + Hono）。IFTTT / Make から Webhook 経由でメッセージ送信・添付・トークルーム / Bot CRUD を行う薄いラッパ。

> 完了済の整備履歴は [CHANGELOG.md](./CHANGELOG.md) と `git log` を参照。本ファイルは **進行中・未着手のみ**。
> 専用 issue tracker は未使用。機能の SoT は [`README.md`](./README.md)（エンドポイント仕様）、設計判断は [`docs/adr/`](./docs/adr/)、用語集は [`CONTEXT.md`](./CONTEXT.md)。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

---

## 進行中

現状なし。

---

## 未着手 / backlog

### スケーリング

- [ ] **dedup を共有ストア化（Redis 等）** — callback dedup は in-memory Map のため min-instances=1 前提（複数 instance になると instance ごとに別 Map になり dedup が破綻する）。`cloudbuild.yaml` で `--min-instances=1 --max-instances=20` を明示済だが、トラフィック増で 2 instance 目が立ち上がる頻度が上がってきたら Redis 等の共有ストアへ移行する（`callback/dedup.ts`、[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。

### コードの整理

- [ ] **未使用のローカル handler 雛形の去就を決める** — callback は 501 へ転送する案 B（[ADR-0005](./docs/adr/0005-forward-callback-to-501.md)）に一本化したため、`src/services/lineworks/callback/{dispatch,handlers,reply}.ts` のローカル応答 handler は現在呼ばれない（雛形として残置）。501 側に応答ロジックが定着したら削除するか、ローカル応答が必要になったら案 A（本サーバ内応答）として復活させるかを判断する。

### 拡張余地（必要になったら）

- [ ] **メッセージ型の追加** — 新しい LINE WORKS メッセージ型が必要になったら `services/lineworks/messages/index.ts` の `messageSchemas` に Zod schema を 1 件足すだけ（route とディスパッチャは自動追従、[ADR-0007](./docs/adr/0007-message-type-dispatcher.md)）。
- [ ] **新 callback event type への追従** — LINE WORKS 仕様変更で event type が増えたら `callback/schemas.ts` の `discriminatedUnion` に追加する（未知 type は現状 400 で reject）。
- [ ] **アクセストークンの追加スコープ** — 現状 scope は `bot` 固定。他スコープが必要になったら `auth.ts` を分岐させる前に LINE WORKS 側の権限設定を確認する。

### ワークフロー（任意）

- [ ] **AFK-agent ワークフローの有効化** — issue → triage → PRD → 実装 を回したくなったら `setup-matt-pocock-skills` を再実行し、issue tracker = GitHub Issues を選んで `docs/agents/issue-tracker.md` + triage-labels を再生成する（[`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)）。

---

## 参考

- エンドポイント仕様: [`README.md`](./README.md)
- 設計判断（ADR）: [`docs/adr/`](./docs/adr/)
- 用語集: [`CONTEXT.md`](./CONTEXT.md)
- 運用ゴッチャ: [`CLAUDE.md`](./CLAUDE.md)
