# Formation and owner operations

## Assignment と report

- assignment の goal、repo、touching、受入条件、上限、権限を確認してから claim する。
- owner が scope を変えるときは current assignment を cancel してから新しい ID で再割当する。note だけで scope を上書きしない。
- lane は status の最新 revision と current assignment ID を使って report する。delivery が unconfirmed の report を再実行しない。
- CANDIDATE_READY は ACK と integration acceptance の代わりにならない。Commander は対象 SHA、check、review、残件を確認する。
- Shipper は検証済み modern_cli capability を持つ member だけ。ship は Formation shipping runbook に従い、承認されていない push / deploy を行わない。
- report / assign / note / ACK / cancel / release の構文は agent-room formation <action> --help で確認する。

詳細: [Formation skill](https://github.com/fujimogn/agent-room/blob/main/skills/formation/SKILL.md)、[contract](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/contract.md)、[messaging](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/messaging.md)。

## Council

Council の gate 設定、承認、canary は別の承認境界として扱う。準備やstatus確認を、本番操作の承認と見なさない。各操作の引数と停止条件は agent-room council <action> --help および該当 repo の正本 runbook で確認する。

## UI と skill 配布

- agent-room UI は localhost と read-only token の前提を守る。UI の状態表示を、write 操作や外部送信の許可と解釈しない。
- skill の status / install は対象と dry-run / apply 範囲を先に確認する。配布元を越えて同期しない。
- 操作構文と現在の適用範囲は agent-room ui --help、agent-room skills <action> --help で確認する。

runtime / role / capability の現在値は [runtime guide](https://github.com/fujimogn/agent-room/blob/main/docs/agents/runtime.md) を参照する。
