# Formation contract

Formation は、同じ Herdr workspace の選択 pane を1つの repo と goal の下で編成する。開始条件、pane 数、除外条件は [Formation skill](https://github.com/fujimogn/agent-room/blob/main/skills/formation/SKILL.md) に従う。

## Goal と責任

- Commander は goal、repo、受入条件、touching、権限境界、期限や上限を assign に明記する。lane は記載範囲を実行し、曖昧または矛盾する指示は推測で埋めない。
- 作業を分割する場合、各 assignment に担当、具体的な成果、許可パス、完了条件を置く。子laneは親の repo・touching・権限・同時実行数を引き継ぐ。
- scope変更は note だけで暗黙に行わない。Commander が旧 assignment を cancel し、新しい範囲で再割当する。
- Commander は調整・確認・統合責任を持つ。実装laneは割当範囲の作業を完了し、review lane は独立した固定対象の review を行う。
- 同一 member は原則として実行中1件とACK待ち1件まで。前件の CANDIDATE_READY をACKする前に次 assignment を与えない。
- 最新 origin/main を起点に専用 worktree を使う。共有 checkout に書かず、他 lane の変更を戻さない。

## Member-first / capacity

- Commander mode は `director-only` が既定。owner が範囲を許可した場合だけ `director-and-implementer` を選ぶ。候補値は `type CommanderParticipation = 'director-only' | 'director-and-implementer'`。
- 選択・admit した各 member pane に重複しない上位 assignment を確定してから下位 work を dispatch する。下位workを未割当memberの代替にした計画はdispatchせず、各memberの上位assignmentを再計画する。
- `laneLimit` はCommanderを含むlane数の上限であり、member数は`laneLimit - 1`。roster は `FORMATION_MIN_ROSTER_PANES` から `FORMATION_MAX_ROSTER_PANES` の範囲に収める。
- `commanderParticipationMode` は明示値として扱う。値が無い・不明なら director-only とし、推測で Commander の実装権限を広げない。

## 実行・停止

- 開始時に goal、repo、受入条件、touching、現在の assignment ID を台帳で照合する。不一致、cancel済み assignment、権限不足、停止中の依存があれば変更せず報告する。
- challengeは発行時刻以上・失効時刻未満、同じFormation、未consumeの場合だけ有効で、期限切れ・不一致を拒否し、admit成功時に一度だけconsumeする。
- 進行は受入条件に結び付けて管理する。長時間無応答、未着手、待ち状態を見つけたら所有者と次の行動を特定する。idle や done は完了の証拠ではない。
- 同じ repo の変更は所有範囲を分ける。統合が必要な受入条件には、接続・配線の確認と境界を守る test を含める。
- Member は割当を完了できないとき、根拠と必要な判断を報告する。司令塔の応答を待つ間に、許可されていない代替作業へ広げない。
- TGL / Formation の詳細な役割と runtime 能力は [runtime guide](https://github.com/fujimogn/agent-room/blob/main/docs/agents/runtime.md) を参照する。

## Reports と完了

- lane は現在の assignment ID と最新台帳 revision を使って報告する。許可されたイベントは STARTED、RED、BLOCKED、CANDIDATE_READY。
- note は履歴であり、assignment の scope を変えない。最新 status の assignment と未読 note を確認してから次の操作を選ぶ。
- 通知は台帳の代替ではない。Formation CLI の status で現在状態を照合し、別経路で手動送信しない。
- report の delivery が unconfirmed なら同じ report を再実行しない。先に台帳を確認し、判断が要れば司令塔へ report する。
- CANDIDATE_READY は review / ACK / integration acceptance の完了を意味しない。司令塔が固定差分を確認しACKした後にだけ lane の仕事を閉じる。
- 閉鎖前に各 lane の結果、未解決事項、統合状態、受入根拠を照合する。idle lane や終了した pane だけでは goal を閉じない。
- closeの`--acceptance`は最新statusからstart時の全条件を取り直し、文言・重複数を変えず全件渡す（順序のみ不問）。先に全memberをreleaseし、`--excluded-candidate`はstart時の除外集合からreseatで追加した候補を除いて1件ずつ渡す。`--remove`した候補は戻さない。close拒否の代表は`formation_close_incomplete` / `active_lanes`。
- close dossierでS6のCLI外連絡なしを確認する。採用日は2026-09-17、基準commitは`434fa51df6caa04546f10107d13bb73963813bae`。採用前の違反と是正を残し、採用後の違反・不明は未充足とする。degraded配送は件数・理由・衝突し得た区間・観測不能範囲を棚卸しし、未観測をゼロとしない。
- ship の責任は Commander または明示された適格 Shipper が持つ。Shipper は検証済み modern_cli capability がある場合に限る。ship の手順は [formation shipping runbook](https://github.com/fujimogn/agent-room/blob/main/docs/runbook/formation-shipping.md) を参照する。

## 中断・再配置

- 長い停止には handoff を残し、現在の assignment、完了済み作業、未解決事項、次の安全な一手を記録する。[handoff reference](https://github.com/fujimogn/agent-room/blob/main/skills/agent-room-ops/references/handoffs.md) の frontmatter を守る。
- 同じ lane の再開では台帳の current assignment と notes を先に確認する。担当が変わっていれば旧作業を続けない。
- 別 pane / member に再配置する前に、旧 lane が assignment を実行中でないことを台帳で確認する。pane を閉じたり外したりする前に責任と lease を解放する。
- stale な pane 情報や失敗した CLI 操作を、手動送信や台帳の直接編集で回避しない。安全な復旧手順が分からなければ止めて報告する。

## Challenge・roster・attachmentの復旧

- 最終操作から48時間を超えて書込みがないFormationは、次の台帳write-open時に行ごと自動解散する（ちょうど48時間は残る）。closeの代用ではない。
- rosterからpaneを外す前に、対象assignmentを回収し`release`してから`reseat --remove`する。paneを閉じてからだと`formation_selected_pane_not_found`になり得る。古いrevisionは`revision_conflict`。reseatの代表拒否は`formation_reseat_candidate_not_found:<pane>`、`candidate_not_selected`、`duplicate_candidate`、`commander_not_removable`、`reseat_candidate_attached`、`lane_has_unrecovered_assignment`、`workspace_mismatch`、`repository_mismatch`、`duplicate_attachment_identity`、`invalid_lane_limit`。枠が11ならremoveとaddを別commandにする。
- 同じpaneのagent交代はreseatでなく、司令塔が旧assignmentを`cancel` → 旧laneを`release` → 新lane IDで`challenge` → 新agentが`claim`する。
- goal未達でFormationを止める時だけdisbandする。先にhandoffを保存し、最新statusの`lanes[].assignment`にある`released`以外を`--abandon`で全件そのまま渡す。activeな子作業も拒否対象（`disband_unrecovered_assignment`）。代表拒否は`disband_handoff_unavailable`、`storage_failure`。不確かな結果では先にstatusを読み、`formation_not_found`なら行は削除済み。台帳を手で消さない。
- `nativeSessionId`がnullのattachmentはHerdrの`terminal_id`一致も要求するため、server再起動でIDが再発行されるとそのpaneの書込みが止まり、commanderなら複数操作が凍結する。claimにはfreshな`--native-session <agent_session>`を渡し、claim直後に値が保存されたことを確認する。省略・`-`・空白は明示nullでなくlive再観測へ戻り、観測できなければnullのまま。
- memberだけが失効しcommanderが有効なら、止まったassignmentをcancelし、laneをrelease、新lane IDで同じpaneへchallengeして`--native-session`付きでclaimする。commanderも失効した場合はworktree成果を回収してhandoffしFormationを組み直す。台帳を直接編集せず、48時間後の自動解散を待つ。
- `--native-session`はliveのagent sessionとの再照合に使うため、古い値を固定入力しても再起動耐性にはならない。claim後にstatusと実paneの状態を照合する。
- CLI引数は `agent-room formation <action> --help` を参照する。challenge TTLは60,000〜900,000msで、発行・失効時刻の境界とconsume規則は[Messaging](https://github.com/fujimogn/agent-room/blob/main/skills/formation/references/messaging.md)に従う。

## Owner 判断

- goal、受入条件、touching、権限、外部操作、ship / deploy の責任に影響する判断は Commander に上げる。
- lane 間で矛盾する指示、未定義の権限、cancel 後の作業要求は、勝手に選ばず status と根拠を付けて BLOCKED または RED で報告する。
- owner が必要な承認を明示するまで、外部・本番操作を実行しない。
