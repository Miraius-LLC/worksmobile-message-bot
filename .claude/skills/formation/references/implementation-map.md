# Formation decision map

この reference は運用上の判断先を示す。実装構造や内部 module の一覧は持たない。

| 判断 | 進む先 |
|---|---|
| Formation を使うか、pane と goal の範囲を決める | [Formation skill](https://github.com/fujimogn/agent-room/blob/main/skills/formation/SKILL.md) |
| assignment、member、停止条件、ship / close の責任を決める | [contract](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/contract.md) |
| note、差し替え、status、report の扱い | [messaging](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/messaging.md) |
| blind review の固定範囲と判定 | [review](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/review.md) |
| CLI の引数や例を確認する | agent-room formation <action> --help |
| 運用中に ship、deploy、rollback を行う | [formation shipping runbook](https://github.com/fujimogn/agent-room/blob/main/docs/runbook/formation-shipping.md) |
| TGL の lane / gate / evidence を選ぶ | [TGL skill](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/SKILL.md) |
| runtime、model、pane capability の現在値を確認する | [runtime guide](https://github.com/fujimogn/agent-room/blob/main/docs/agents/runtime.md) |

CLI や公開文書を超える実装詳細が必要なら、該当 repo の owner に調査範囲を確認してから進める。
