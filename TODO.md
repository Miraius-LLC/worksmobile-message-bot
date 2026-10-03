# worksmobile-message-bot 実装 TODO

LINE WORKS Bot の Webhook サーバー（Bun + TypeScript + Hono）。IFTTT / Make から Webhook 経由でメッセージ送信・添付・トークルーム / Bot CRUD を行う薄いラッパ。

> 完了済の整備履歴は [CHANGELOG.md](./CHANGELOG.md) と `git log` を参照。本ファイルは **進行中・未着手のみ**。
> 「必要になったら足す」型の拡張手順（メッセージ型追加 = [`.claude/rules/services.md`](./.claude/rules/services.md)、callback event type 追従 = [`README.md`](./README.md) の callback 節、AFK-agent ワークフロー有効化 = [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)）は TODO ではなく各文書に置く。
> 専用 issue tracker は未使用。機能の SoT は [`README.md`](./README.md)（エンドポイント仕様）、設計判断は [`docs/adr/`](./docs/adr/)、用語集は [`CONTEXT.md`](./CONTEXT.md)、運用ゴッチャは [`CLAUDE.md`](./CLAUDE.md)。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

## 次に着手

- [ ] **Cloud Run 向けの記述を現在の稼働状況に合わせる**。現在地: 2026-10-03 に GCP project `office-381404` を GET で照会し、Cloud Run の service は 0 件、`worksmobile-message-bot-sa` も存在しなかった（稼働は Cloudflare Workers のみ）。`README.md` の「Cloud Run へのデプロイ」節・`cloudbuild.yaml`・`Dockerfile` は Cloud Run への deploy を前提にしたまま。Cloud Run はまた使う可能性があるので、構成は残す。次: `README.md` に「現在は Cloud Run に deploy していない」ことと、再開時に要る GCP 側の準備（service account、Secret Manager、Cloud Build trigger）を明記する。完了条件: `README.md` を読んで、いま動いている実行基盤と、Cloud Run が休止中であることが分かる。SoT: [`README.md`](./README.md)、develop-meta の `infra/docs/registry-history.md`（worksmobile-message-bot の節）。

## いつか

- [ ] **信頼性・スケーリング: Durable Queue による非消失キューイング** — 現行は Cloud Run / Workers 共通で同期 await 転送、失敗時 500 + ログ出力とし、`unregister` は手動再投入用。転送先障害時にもイベントを確実に滞留・再処理する厳密な非消失保証が必要になった場合に Durable Queue を検討する（[調査メモ](./docs/research/lineworks-callback-bot-id-async-2026-08-13.md)）。
- [ ] **信頼性・スケーリング: dedup を共有ストア化** — Workers isolate 間や Cloud Run instance 間で wmbot 内 Map は共有されない。gateway 単体で厳密な一回処理が必要になった時だけ共有ストアまたは upstream 側 idempotency を導入する（`callback/dedup.ts`、[ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)）。
