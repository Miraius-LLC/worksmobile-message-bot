# TGL start and routing

TGL は、複数の独立 lane を束ねる Director workflow。目的と分割条件は [TGL skill](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/SKILL.md) を参照する。

## 開始前の確認

- repo の owner、最新 base、worktree 状態、関連する仕様と受入条件を確認する。
- lane ごとに独立した成果、touching、依存、完了条件が作れるかを確かめる。できなければ分割しない。
- 時間上限、並行数、外部操作、必要な Human Gate を明記する。

## Routing

- route / dispatch / review は auto を既定にする。手動指定は、必要な capability、domain 経験、provider 制約、混雑など具体的な理由がある場合だけ。
- 同じ差分の実装と独立 review を同一 agent に割り当てない。
- assignment に repo、目的、paths、完了条件、test / evidence を書く。期限や上限があるなら明示する。
- lane が仕事を終えたことを示す証拠が揃うまで、status や idle だけで完了判定しない。
- prompt や dispatch が現行の割当と矛盾するときは止め、owner の判断を待つ。

TGL の開始・route・dispatch の構文は agent-room tgl <action> --help で確認する。
