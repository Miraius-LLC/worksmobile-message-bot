# worksmobile-message-bot 実装 TODO

LINE WORKS Bot の Webhook サーバー（Bun + TypeScript + Hono）。IFTTT / Make から Webhook 経由でメッセージ送信・添付・トークルーム / Bot CRUD を行う薄いラッパ。

> 完了済の整備履歴は [CHANGELOG.md](./CHANGELOG.md) と `git log` を参照。本ファイルは **進行中・未着手のみ**。
> 「必要になったら足す」型の拡張手順（メッセージ型追加 = [`.claude/rules/services.md`](./.claude/rules/services.md)、callback event type 追従 = [Callback](./docs/reference/callback.md) の event 種別節、AFK-agent ワークフロー有効化 = [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)）は TODO ではなく各文書に置く。
> 専用 issue tracker は未使用。機能の SoT は [HTTP API](./docs/reference/http-api.md) と [Callback](./docs/reference/callback.md)、設計判断は [`docs/adr/`](./docs/adr/)、用語集は [`CONTEXT.md`](./CONTEXT.md)、運用ゴッチャは [`CLAUDE.md`](./CLAUDE.md)。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

## 次に着手


## 待ち

- [ ] **Cloud Run を再開するときの確認**。現在地: Docker がなく `.config/Dockerfile` の build は未検証。`.config/gcloudignore` が `.env.*` を除外し、Cloud Build で `.env.tpl` を読む `bun test` が失敗しうる。始める条件: Cloud Run 再開時。次: Docker build と Cloud Build のテストを実行する。完了条件: 両方を検証し、必要な修正を終える（[設定テスト](./tests/config/operations-config.test.ts)）。

## いつか

- [ ] **Hono 5 の評価**。現在地: 2026-10 に RC が公開されたが、現行実装への差分の詳細は未確認。始める条件: 安定版の公開後。次: 変更点と現行の route・認証・validation への影響を調べる。完了条件: 更新の要否と必要な対応を決める（[調査文書](./docs/research/bun-hono-release-notes-2026-11-09.md)）。
- [ ] **信頼性・スケーリング: Durable Queue による非消失キューイング** — 現行は Cloud Run / Workers 共通で同期 await 転送、失敗時 500 + ログ出力とし、`unregister` は手動再投入用。転送先障害時にもイベントを確実に滞留・再処理する厳密な非消失保証が必要になった場合に Durable Queue を検討する（[調査メモ](./docs/research/lineworks-callback-bot-id-async-2026-08-13.md)）。
- [ ] **信頼性・スケーリング: dedup を共有ストア化** — Workers isolate 間や Cloud Run instance 間で wmbot 内 Map は共有されない。gateway 単体で厳密な一回処理が必要になった時だけ共有ストアまたは upstream 側 idempotency を導入する（`callback/dedup.ts`、[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。
