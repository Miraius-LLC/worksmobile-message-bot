# Issue tracker

このリポジトリは **専用の issue tracker（GitHub Issues / `.scratch/` 等）を使っていない**。進行中・未着手の作業はrootの`TODO.md`で追跡する。

| 対象 | 役割 |
|---|---|
| [`TODO.md`](../../TODO.md) | 進行中・未着手の作業。完了後はCHANGELOGとgit logへ移す |
| [`README.md`](../../README.md) | 現在の構成と詳細文書への入口 |
| [HTTP API](../reference/http-api.md) / [Callback](../reference/callback.md) | HTTP ルート・入力制約・callback 受信仕様 |
| [`CLAUDE.md`](../../CLAUDE.md) | コードから読めない規約・運用ゴッチャ |
| git commits | 完了した変更履歴（gitmoji + 日本語 subject）|

## product 系 skill は現状非アクティブ

`to-issues` / `triage` / `to-prd` は issue tracker（GitHub Issues 等）を前提とする。本リポはソロ開発で、機能の SoT は HTTP API・Callback（仕様）+ commits（履歴）のため、これらは **現状使わない**。triage labels も未設定。

engineering core（`tdd` / `grill-with-docs` / `improve-codebase-architecture` / `diagnose` / `zoom-out`）は issue tracker を必要とせず、domain docs（[`docs/agents/domain.md`](./domain.md)）だけを読むので問題なく動く。

## GitHub Issues を有効化したくなったら

将来 AFK-agent ワークフロー（issue → triage → PRD → 実装）を回したくなったら `setup-matt-pocock-skills` を再実行し、issue tracker = GitHub Issues（remote `Miraius-LLC/worksmobile-message-bot`、`gh` CLI）を選んで本ファイルと triage-labels を再生成する。
