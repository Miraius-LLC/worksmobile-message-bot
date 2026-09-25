# TGL ship and close

## Ship 準備

Ship 前に、受入条件、test、独立review、解決済み指摘、対象 SHA、branch / base 状態を確認する。古い base の上に追加commitが入った場合は、新しい base と head で再検証する。

Queue や ship-ready 判定は準備状況の証拠であり、それ自体は merge、push、deploy を実行しない。操作の責任者、対象、必要な承認を確認してから認められた経路を使う。Formation の owner / Shipper 境界は [formation shipping runbook](https://github.com/fujimogn/agent-room/blob/main/docs/runbook/formation-shipping.md) を参照する。

CLI の構文は agent-room tgl ship --help と agent-room tgl status --help で確認する。

## Close

close 前に以下を確認する。

- 全 lane の受入条件と最終状態が証拠付きで記録されている。
- 必須 review が対象 SHA に対して GO で、指摘が解決済み。
- merge / integration の結果と最終 branch 状態が分かる。
- 未完了作業は owner、次の行動、blocker を持ち、handoff または TODO に移されている。
- 新しい TODO が既存の task / incident と重複しない。

close 時の検証・記録は上の checklist を evidence と照合する。TGL の終了後に workflow 改善を行う場合は [TGL Kaizen skill](https://github.com/fujimogn/agent-room/blob/main/skills/tgl-kaizen/SKILL.md) に任せる。review gate の再発防止は [gates](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/gates.md) に集約する。
