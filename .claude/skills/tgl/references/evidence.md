# TGL evidence

Evidence は lane の状態と受入条件を照合できる量に絞る。観測できない値は unknown のままにし、成功やゼロ件へ補完しない。

## Dispatch

記録する項目: lane / owner、目的、touching、base、受入条件、依存、制限、dispatch run ID。run ID は dispatch の結果から取得する。

## Working

各更新では、実施したこと、変更 path、直近の検証、次の行動を示す。blocker は観測結果と必要な判断を添える。失敗後に再試行する場合は、再試行の理由と新しい範囲を記す。

## Ship

固定した base / head SHA、最終 diff、check の結果、独立 review run ID と判定、残件、integration 状態を記録する。status が unable なら受入条件未達として扱い、成功に読み替えない。

lane ごとの分割・owner 規則は [lanes](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/lanes.md)、gate と指摘処理は [gates](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/gates.md) を参照する。run ID の確認方法は agent-room run --help で確認する。
