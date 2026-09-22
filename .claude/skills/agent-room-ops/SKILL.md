---
name: agent-room-ops
description: Use when choosing agent-room commands for delegation, room replies, run recovery, queue health, Formation coordination, Council operations, the local management UI, or managed skill distribution.
---

# Agent Room Ops

対象repoのcwdで実行する。repo固有の依頼本文は日本語、先頭は `repo:<allowlist上のrepo名>` + 空行。branch / worktree名をrepo名にしない。

他agentへの依頼は `agent-room delegate`。藤井の明示指示なしにclaude / codex / agy / grok等を直接起動しない。本番chatはDiscord。LINE WORKS / Slack ingressとWorkerは停止中（repoの `docs/runbook/chat-transports.md` がSoT）。

## コマンド選択

| 目的・条件 | 入口 / 判断 |
|---|---|
| 通常のreview・調査・実装依頼 | `delegate`。独立reviewは `--blind`、自動処理で待たない場合は `--no-watch` |
| 対話sessionからroomへ返答 | `respond` |
| runを待つ / 本文回収 / 状態・artifact | `watch` / `reply` / `run`。受付を完了と扱わない |
| queue・配送障害・TGL稼働lane | `status --repo <repo>` / `status --health` / `tgl status --repo <repo>` |
| Formation commander↔member | `formation assign` / `report`。delegate / respond / post / sayで代替しない |
| TGL実装lane / final・integration | `tgl dispatch` / `tgl review`。TGL skillへ |
| 低レベル投稿 | `post` / `say`。通常連携の既定にしない |
| owner向けread-only管理画面 | `agent-room ui`。127.0.0.1のみ、token付きURL |
| Council準備・gate切替・負例確認 | `council prepare` / `set-gates` / `canary`。secret・live操作は承認境界を守る |
| skill配布差分 / 配置 | `skills status` / `skills install`。install既定はdry-run、書込みは `--yes` |

## 操作前のhook

- Formationはassign済みscopeを保持してSTARTED / RED / BLOCKED / CANDIDATE_READYをreportする。CAS操作直前にstatusでrevisionを取り直す。
- 通常はcommanderがCANDIDATE_READYをACKしてから次を配る。CLIのsafe_checkpoint先行割当は既存責任の消失を意味しない。cancelとreleaseを混同しない。
- Formation Shipper適格は検証済み `modern_cli` のみ。TGL ship requestはadvisory queueでありFormation shipを代替しない。
- `accepted` とdelivery確認は別。未確認配送は保存失敗と扱わず、同じcommand-id・同じ引数の再送契約に従う。
- reviewは固定range / path / hashで依頼し、判定と根拠を回収する。Formationでは成果の添付・inlineを使わず、repoの `skills/formation/references/review.md` を読む。
- 長文はartifactへ。氏名以外の機微情報の出力境界を守り、マイナンバー・健康情報・銀行口座番号を出さない。
- 手元のrepo変更はruntime deployまでlive CLIへ届かない。helpとrepo実装の版を分けて確認する。

## 詳細へのrouting

- 通常のdelegate/respond例、self宛て別run、blind review、run回収、TGL連携を行う前: [commands-and-review](references/commands-and-review.md)。
- Formation assign / ACK / cancel / release、Shipper、Council、UI、skills配布を操作する前: [formation-and-owner-operations](references/formation-and-owner-operations.md)。
- handoffを作成・解決する前: [handoffs](references/handoffs.md)。open / resolvedとlanding SHAを冒頭frontmatterで区別し、本文の記録を保持する。
