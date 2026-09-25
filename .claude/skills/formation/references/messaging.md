# Formation messaging

## 通知を受けたら

1. Formation status を読み、lane の current assignment ID、workStatus、revision、notes を台帳で確認する。
2. 関連noteを読み、current assignmentのscopeと照合する。cancel・差し替え・assignmentなし・矛盾があれば止まり、現状を報告する。
3. claim / status / reportはFormation CLIで行い、引数は `agent-room formation <action> --help` で確認する。

## Scope と安全

- assignment が実行権限の唯一の根拠。note は補足や確認であり、それだけで paths、受入条件、権限を拡張しない。
- 連絡・判断要求・進捗報告は Formation CLI の report 経由に限る。手動の room message、別 agent への直接送信、台帳の直接編集をしない。

## 司令塔への配送と再送

宛先のactive attachmentを照合し、Formation CLIが経路を選ぶ。

| 宛先agent | 配送経路 |
|---|---|
| Claude | inbox socket |
| Codex | Codex queue |
| その他 | Herdr agent prompt |

`delivered`は経路への配送記録で、受領・既読・受入ACKではない。challenge consume、assignment terminal、司令塔の`formation ack`をstatusで確認する。

保存済みnote/reportの再送はowner専用の`formation redeliver`で行う。source eventと配送先challengeを明示し、本文・著者・時刻は変えず、再送の監査eventを残す。noteは元の宛先、reportは現commanderへ送る。同じcommand IDのredeliverを繰り返さない。memberはreportが`unconfirmed`でも再実行せず、司令塔が台帳を確認する。redeliverの引数は `agent-room formation redeliver --help` を参照する。

## Report

- report の直前に status を取り直し、その revision と現在の assignment ID を渡す。command ID は同じ論理報告の再送識別に使う。
- event は STARTED、RED、BLOCKED、CANDIDATE_READY を使い、summary は短く一行で要点と根拠を記す。
- delivery が unconfirmed の report は台帳に保存済みの場合がある。再実行せず、status で保存状態を確認する。
- CANDIDATE_READY には commit、clean 状態、検証、review run ID と未解決事項を含める。ACKされるまで完了と扱わない。
- 判断の返答を待つ間は割当範囲を維持し、無関係な次作業を始めない。

詳細な責任境界は [contract](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/contract.md)、review の出し方は [review](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/review.md) を参照する。
