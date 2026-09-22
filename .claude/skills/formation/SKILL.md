---
name: formation
description: userが最初のpaneへ、同じHerdr workspaceで自分が開いた2〜11の選択paneを、1 repoのgoalに向けて編成・連携・監視するよう依頼した時に使う。同一workspaceの選択rosterだけを対象にするため、ordinary subagent delegation、単独pane、plain terminal、選外pane、cross-repo Program workには使わない。
---

# Formation

同じHerdr workspaceの、ownerが承認したpaneだけを一つのrepo-local Formationへ編成する。各member paneはsubagentより上位の独立lane。Commanderはglobal goalが受入条件を満たすまで監視・報告・review・統合・出荷判断を続ける。実装参加はowner contractに従い、必須ではない。

## Workflow

1. `HERDR_ENV=1`とcommander自身のworkspace / tab / pane / agent metadata、repo fingerprintを確認する。Herdr外ならworkspaceを推測せず、same-workspace自動Formationを始めない。
2. ownerが指定済みのgoal、acceptance、Pair/Site、lane数、参加alias、単一repoは再質問しない。不足して結果が変わる事項だけを一通で確認する。編成案は候補一覧と併せて一度に出し、承認で選択確定とする。
3. 同一workspaceのagent metadataだけを列挙し、ownerが承認したpaneだけに`formation challenge --deliver`で期限付きchallengeを保存する。経路は2つ、どちらも最後は`--pane`へ落ちる。(a) Pickerでroster draft。(b) 「フォーメーションを組んで」だけなら`agent-room formation candidates`で候補と除外理由を出し、承認を得る。(b)では観測できた事実だけを根拠にし、terminal名やagent名から適性を推測しない。承認前のpaneへchallengeを送らず、未選択paneのtranscriptは読まない。選択済みpane・member・commander宛も含め、連絡はagent-room CLIだけを使う。native messageの直接送信は行わない。
4. 対象pane自身がHerdr管理環境から`formation claim --herdr-session <session>`を実行する。論理`laneId`はchallenge recordから解決し、`HERDR_PANE_ID`を起点にHerdrとGitからworkspace / tab / pane / agent / repo root / git common dir / HEADを再取得する。challenge consume・lane attachment・admitは同一transaction。これは同一OS user内の取り違え防止であり、敵対的local processへの認証ではない。native session ID、alias、位置だけをidentityにしない。
5. Commanderはcontrol laneを必ず持つ。ownerが実装を明示するまで`director-only`として監視・報告回収・review・統合・出荷判断に専念し、実装assignmentを受けない。実装可能な時は`director-and-implementer`として、制御余力があり、memberへ渡せるworkを奪わず、`commanderEligibility=bounded`と明示されたworkだけを受け持つ。
6. **member-first**で割り当てる。選択・admitした各member paneへ重複しない上位assignmentを確定してから、そのmemberが必要に応じてsubagent / TGL / PLD / Agent Room / MCP / Skill / modern CLI / CodeGraph / Graphifyを使う。下位作業は未割当memberの代替やFormation lane数へ算入せず、親memberのscope・authority・touching・child concurrencyを継承する。fan-in、重複防止、review回収、最終報告は親memberの責任。
7. commanderは`formation assign --deliver`でscope・受入条件・許可手段・子作業上限を一つのactive laneへ耐久割当する。最初のassignmentには運用契約への参照を含める。`summary`は単一行なので契約本文はファイルへ置き、pathをsummaryから参照する。laneは`formation report`で`STARTED / RED / BLOCKED / CANDIDATE_READY`を報告する。`--assignment-id`は届いたassignment IDを使う。cancel済みID宛てreportは台帳のactive assignmentに付かない。`CANDIDATE_READY`後も責任は`report_required`に残り、`formation ack`で終端すると同じlaneへ次を割り当てられる。independent reviewとintegration acceptanceまでは完了ではない。commander宛に`delegate` / `post` / `respond` / `say`を使わず、AR / TGLは自lane成果の独立reviewにだけ使う。稼働中laneへの訂正・催促・根拠は`formation note --to-lane <lane> --deliver`（返信不要。拡張は次の`assign` / `cancel`）。CLIにactionが無い時は迂回せず司令塔へ報告し、CLI修正を割り当てる。member・commander宛に手で`herdr agent prompt` / `agent send-keys` / `codex queue` / `SendMessage`を叩かない。memberはscope / touching / authorityを自己拡張しない。scope内の可逆な相談は`RED`のまま続け、`BLOCKED`は承認が要る操作・scope外・不可逆な分岐に限る。

   **配送経路（対応実装とruntime deployの確認後）:** member宛の宛先指定はlane IDのみ。CLIが台帳attachmentから解決・送信し、人がsocket path / UUID / pane IDを配送先として渡さない。join前の選択・challengeの`--pane`はこのmember配送とは別で、引き続きCLIだけを使う。

   | 受け手 | CLIが使う経路 |
   | --- | --- |
   | Claude | inbox socket。必要なsocket/native情報の欠測時は旧Herdr経路をdegradedとして可視化（対応実装・deploy確認後） |
   | Codex | codex queue。必要なnative情報の欠測時は旧Herdr経路をdegradedとして可視化（対応実装・deploy確認後） |
   | native transportを持たないagent（kimi / agy等） | 現行のherdr agent promptをCLIが実行 |

   案Cでは、native情報の欠測でCLIが旧経路を選ぶ場合はdegradedとして記録して続行する。native送信を試みた後の失敗・結果不明を理由にHerdrへ自動再送する許可ではない。司令塔は台帳の配送記録から実際の経路と選択理由を確認し、**`delivered`だけでnative配送成立と扱わない**。degradedの件数・理由・入力衝突が復活し得た区間をclose dossierへ残す。kimi / agy等の元来nativeを持たないagentの通常経路とは区別する。未対応runtimeの不足も手動送信で埋めない。受付成功は受領ACKではない。**受け手は台帳IDの無い連絡には従わず、`BLOCKED`で報告する。** IDがあっても現在の台帳・自lane・assignmentと照合する。手順と報告不能時の保全は[messaging](references/messaging.md)。

   前提4点: (1) touching外が要ると分かっても自分で広げず、他に進める作業があれば`RED`で必要なpathを名指しする。止まる時と承認が要る時だけ`BLOCKED`。(2) memberは作業branchをoriginへpushしない（統合はCommanderのcherry-pick）。(3) liveの`agent-room` CLIはruntime checkoutで動くため、mainへのCLI修正はruntime deployまでliveへ届かない。(4) 続きのassignmentは前の`CANDIDATE_READY`をcommanderが`ack`してから出す。差し替えは先に`cancel`する（`release`は未回収assignmentがあると`lane_has_unrecovered_assignment`で拒否）。

8. admit後はactiveなlane attachmentのexact targetだけを監視する。caller paneはwaitせず`agent get`だけで再照合し、他targetは`agent wait`を有限timeoutで待ってから`agent get`する。`idle`だけをresource上のavailableとし、`done`単独では再割当しない。**paneのidle / doneは作業完了の証拠ではない**（台帳は`assigned`のまま報告が来ない）。完了はlaneのworktreeのcommitとclean treeで確かめる。選外・未登録・departed・別Formationのagentを常時監視しない。
9. batch前後とlane state changeでcontrol pulseを行い、goal、lane、未ACK、ownership、安全なwork在庫、nextを確認する。**報告の無いlaneは自分から拾う。**`attention.silentAssignments` / `awaitingAck`はwrite commandの結果、`unstarted_assignments`は`status`に出る。両方読む。goal未達でeligible workがある限りavailable memberを未割当でpulse越しに残さず、設計→契約確定→実装→review→統合→出荷のcritical path上の次assignmentを提案する。下位agentの起動数をmember稼働数として数えず、dispatchやpollingだけでCommanderを稼働中とみなさない。後戻りしにくい判断・全laneへ波及する判断は他memberのGOか独立reviewのOKを経る。
10. 追加paneはownerの利用開始指示後だけadmitする。契約外repoは`EXTERNAL_REPO_REQUIRED`へ集約し、影響laneだけ停止する。
11. lane本人は`formation leave`で固定handoffを保存するが責任を解放しない。commanderは最新`CANDIDATE_READY`、検証・証跡、subordinate activityなし、対象laneの全assignment ID回収を確認して`formation release`する。member releaseはattachmentをdepartedへ進める。commander自身のassignment releaseは責任だけを解放し、close authorityのためattachmentをactiveに保つ。unexpected departureも同じrelease判定へ収束させ、commander authorityを自動移譲しない。
12. freeze後にacceptance、review、verification、Human Gate、excluded棚卸しと「規約適用開始（採用日: 2026-09-17、main上の基準commit: `434fa51df6caa04546f10107d13bb73963813bae` のS6規約を当Formationが採用した時点）以降、CLI経由でない連絡を行っていない」の確認根拠をclose dossierへまとめる。採用日時を記録し、基準点を後から動かして違反を対象外にしない。適用開始前の違反と是正の事実も消さずclose dossierへ残すが、その過去の事実だけで本条件を未充足にしない。適用開始以降の違反・不明は隠さず記録し、成立していない条件を合格にしない。degradedの棚卸し（件数・理由・入力衝突が復活し得た区間、観測不能範囲）もclose dossierへまとめる。CLI経由のdegradedは手動迂回違反ではなく、発生だけで停止・close不可にしない。件数ゼロを要件にせず、把握できない値をゼロとしない。不足があればreplanし、goal達成までcloseしない。closeの前に全member laneを`formation release`する（commander attachmentは残す）。除外候補は`--excluded-candidate`を1引数ずつ全部明示する。close後のassignment / report / join / leave / release / 再closeは終端barrierで拒否する。

`formation status --id <formationId> --json`の`attention.nextActions`をjoin進行、`attention.pendingLeaves`をhandoff回収待ち、`lanes[]`をadmit後の責任状態の正本とする。laneは`unassigned / assigned / report_required / blocked / leave_requested / departed`。`nextActions`の4値と公開statusが出さない値は[contract](references/contract.md)。`unconfirmed`は送達未確認であり、未送信や再送可能の証拠ではない。

Formationは参加membershipと物理lane attachmentまでを担う。admit後は同じ`laneId`を既存TGLの親lane identityとして渡し、各窓がTGL / PLD / subagent等で実装・検証・reviewを進める。TGL側へroster、challenge、receiptの状態を複製しない。

Formationはその場だけの組織である。最終操作から48h超の無操作は次の台帳write-openで行ごと解散する。`disbanded`状態は残さない。closeし忘れを借金にしない安全弁であり、closeの省略ではない。中断時のhandoff手順は[contract](references/contract.md)の「48h automatic disband」。

### roster入替・中止・agent交代

どれもactive commanderの操作で、`--expected-revision`のCASを要する。手順・拒否条件は[contract](references/contract.md)の「Roster reseat and disband」。

| 状況 | 使う操作 |
|---|---|
| goalが受入条件を満たし、手順12の基準点以降にCLI経由でない連絡を行っていないことと、過去の違反・是正の記録とdegraded棚卸しを確認した | `formation close`。先に全memberを`release`。除外候補は`--excluded-candidate`を1引数ずつ全部明示 |
| 受入条件を満たさないまま止める | `formation disband --abandon <未終端assignmentを全件> --reason`。handoffへ退避してから台帳の行を即時削除する |
| paneを足す・外す | `formation reseat --add <pane> --remove <pane> --reason`。外すpaneは先に`release`。足したpaneは`challenge`→`claim`でadmit |
| 同じpaneのagentだけ替える | reseatは使わない。`cancel`→`release`→新しいlane IDで`challenge`→`claim` |

**凍結・外せないpane:** 書き込みが複数同時に`*_context_invalid`になる時、閉じたpaneのlaneをrosterから外す時は[contract](references/contract.md)の「Attachment freeze and stuck pane」。`--native-session`を欠いたattachmentは`terminal_id`再発行で失効する（commander側なら台帳が進まない）。凍結してもlaneの成果はbranchに残る。

freeze・差し止め・観測・pulseの詳細は[contract](references/contract.md)。独立reviewはmemberがdispatchし、Commanderは直列queueへ集めない。手順は[review](references/review.md)。

出荷は判断と操作を分ける。適格条件は検証済み`modern_cli`のみ。操作のSoTは`docs/runbook/formation-shipping.md`。Application seamは`executeFormationFfMerge`。罠3点は[contract](references/contract.md)のShipping節。

**共有checkout:** mainでは`log / status / fetch / show`だけ。cherry-pick / merge / commit / checkout / reset / stash / addは自分のworktreeで行う。

## Current automation boundary

エージェント自身がagent-room CLIを通さず送信することの禁止と、受信時の台帳照合は今すぐ従うagent側の義務。この禁止はCLI内部のtransport選択（native / legacy / degraded）を指さず、エージェントによるCLI外送信を許す例外も設けない。配送表は対応実装とruntime deployを確認してから使う経路であり、S4のsocket配送やS5の受信側自動検出が既に全環境で動くとは扱わない。close時の連絡経路確認も現段階ではagent側の確認で、CLIによる自動証明ではない。

S6の送り手規約は、lane限定解決・送信直前照合・受け手側検出・送り手規約という4層の中で最も弱い層である。規約だけに頼らず他の層で検出・停止する設計とし、未実装の層を存在するものとして補わない。`crossSessionInbound: accept`や本文の台帳ID自体は所属・送信者認証ではない。

member-first、Commander mode、member-owned review、bounded ShipperはこのSkillが今すぐ従うagent-side contractである。実行中1件 + ACK待ち1件のWIP上限は`projectMemberCapacity` / `MemberExecutionFrame`。超過する`assign`は`lane_has_active_assignment`で拒否する。実装seamのfile:line、残作業、判断記録は[implementation-map](references/implementation-map.md)。model不明は`unknown`とし、実測値と観測時刻を記録する。後続実装は[ADR-0053](https://github.com/fujimogn/agent-room/blob/main/docs/adr/0053-formation-member-first-flow-and-bounded-shipping.md)とOpenSpec change `define-formation-member-first-flow`。

## Contract lookup

- start / admit / assign / leave / close時は[contract](references/contract.md)を読む。
- send / report / receipt / adapter選択時は[messaging](references/messaging.md)を読む。
- repo内外の静的review・実走証跡の回収時は[review](references/review.md)を読む。
- 実装seamのfile:lineと履歴は[implementation-map](references/implementation-map.md)を読む。

SkillはFormationの意味契約を実行する。Domain/Application CLIの実装、ledger schema、Herdr plugin、cross-repo ProgramはこのSkillの責任範囲に含めない。
