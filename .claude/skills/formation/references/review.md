# Formation review

## 固定対象を作る

reviewer に渡す base SHA、head SHA、許可 paths、差分を明示し、review 前に head と対象 worktree が一致することを確認する。依頼の実行後に対象が変わった場合は、その run を現行差分の review と数えない。

依頼の構文は agent-room delegate --help を参照する。Formation review は独立・read-only とし、reviewer は対象差分と受入条件を読む。review 中にファイル編集、test、commit、live 操作を行わない。

## 判定

- GO は固定差分が受入条件を満たし、再現可能な blocker がない場合だけ。
- blocker は該当 path と行、または再現手順を示せる誤動作・安全違反・受入条件違反に限る。対象外の提案は blocker にしない。
- run が起動しない、出力が回収できない、hash が一致しない場合は review 不成立として扱い、GO と数えない。
- review は原則1回。修正が必要なら修正箇所だけ再reviewし、同じ指摘の全差分reviewを繰り返さない。
- review 結果、run ID、対象 SHA、未解決事項を report と共に記録する。

TGL の gate と証拠基準は [TGL gates](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/gates.md) を参照する。
