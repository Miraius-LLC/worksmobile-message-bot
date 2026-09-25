# Commands and review

## 依頼・返信・run 回収

- 新規の独立依頼は delegate、既存 room の問いへの返信は respond を使う。
- run ID を保持し、完了まで watch / run で結果を回収する。起動したことだけで完了とみなさない。
- 依頼本文は日本語で、repo allowlist 名、目的、touching、検証条件、必要な worktree を明記する。repo 内 path を含む依頼では repo を明示する。
- CLI の引数、宛先、watch 方法は agent-room delegate --help、agent-room respond --help、agent-room run --help を参照する。

## Blind review

- 実装者から独立した reviewer に、固定 SHA と許可 paths を渡す。reviewer の権限は read-only。
- 自分の確認を済ませてから依頼し、review run ID と判定を回収する。
- 未回収、別 SHA、失敗 run を GO と数えない。修正後は修正箇所だけを再reviewする。
- TGL の routing / gate は [TGL skill](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/SKILL.md) と [gates](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/gates.md) を参照する。
