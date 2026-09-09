---
name: formation
description: userが最初のpaneへ、同じHerdr workspaceで自分が開いた2〜5の選択paneを、1 repoのgoalに向けて編成・連携・監視するよう依頼した時に使う。同一workspaceの選択rosterだけを対象にするため、ordinary subagent delegation、単独pane、plain terminal、選外pane、cross-repo Program workには使わない。
---

# Formation

同じHerdr workspaceにある、ownerが承認したpaneだけを一つのrepo-local Formationへ編成する。各member paneをsubagentより上位の独立laneとして稼働させ、Commanderはglobal goalが受入条件を満たすまで監視・報告・review・統合・出荷判断のループを続ける。Commanderの実装参加はowner contractに従い、必須ではない。

## Workflow

1. `HERDR_ENV=1`と、commander自身のworkspace / tab / pane / agent metadata、repo fingerprintを確認する。Herdr外ならworkspaceを推測せず、same-workspace自動Formationを開始しないでmanual baselineを案内する。
2. ownerが指定済みのgoal、acceptance、Pair/Site、lane数、参加alias、単一repoは再質問しない。不足して結果が変わる事項だけを一通で確認する。 編成案を出す時は候補一覧と併せて一度に提示し、承認をもって選択確定として扱う。
3. 同一workspaceのagent metadataだけを列挙し、ownerが承認したpaneだけに`formation challenge --deliver`で期限付きchallengeを保存する。編成の決め方は2経路あり、どちらも最後は`--pane`へ落ちるので実装は分岐しない。(a) ownerがPickerで選んでroster draftを保存する。(b) ownerが「フォーメーションを組んで」とだけ言った時は、Commanderが`agent-room formation candidates`で候補と除外理由を出し、編成案を提示してownerの承認を得る。(b)では**terminal名やagent名から適性を推測せず**、観測できた事実(pane / agent種別 / 稼働状態 / repo / model・effort)だけを根拠にする。観測できない項目は空欄のまま提示し、埋めない。承認前のpaneへchallengeを送らない。CLIはfreshなexact Herdr targetを再照合してclaim promptを配送し、成功後に送達確認だけを記録する。未選択paneのtranscript read、prompt、native messageは行わない。
4. 対象pane自身がHerdr管理環境から`formation claim --herdr-session <session>`を実行する。CLIは論理`laneId`を利用者入力ではなくchallenge recordから解決し、`HERDR_PANE_ID`を起点にHerdrとGitからworkspace / tab / pane / agent / repo root / git common dir / HEADを再取得する。Applicationがchallenge発行時の値と照合してchallenge consume・lane attachment・admitを同一transactionで確定する。これは同一OS user内の取り違え防止であり、敵対的local processへの認証ではない。native session ID、alias、位置だけをidentityにしない。
5. Commanderはcontrol laneを必ず持つ。ownerが実装を明示的に許すまで`director-only`として監視・報告回収・review・統合・出荷判断に専念し、実装assignmentを受けず`director-only`へfail closedする。実装可能な時も`director-and-implementer`として、制御余力があり、memberへ渡せるworkを奪わず、`commanderEligibility=bounded`と明示されたworkだけを受け持つ。
6. **member-first**で割り当てる。選択・admitした各member paneへ重複しない上位assignmentを確定してから、そのmemberが必要に応じてsubagent / TGL / PLD / Agent Room / MCP / Skill / modern CLI / CodeGraph / Graphifyを使う。下位作業は未割当memberの代替やFormation lane数へ算入せず、親memberのscope・authority・touching・child concurrencyを継承する。fan-in、重複防止、review回収、最終報告は親memberが責任を持つ。
7. commanderは`formation assign --deliver`でscope・受入条件・許可手段・子作業上限を一つのactive laneへ耐久割当する。最初のassignmentには運用契約への参照を必ず含める。`summary`は単一行しか受け付けないため、join promptが契約を運ぶまでの暫定として契約本文はrepositoryまたはowner領域のファイルへ置き、そのpathをsummaryから参照する。laneは`formation report`で`STARTED / RED / BLOCKED / CANDIDATE_READY`を報告する。`CANDIDATE_READY`後も責任は`report_required`に残り、commanderが`formation ack`で終端すると同じlaneへ次のassignmentを割り当てられる。independent reviewとintegration acceptanceまでは完了ではない。commander宛の連絡にAgent Roomの`delegate` / `post` / `respond` / `say`を使わず、AR / TGLは自lane成果の独立review依頼にだけ使う。Formation CLIに必要なactionが無い、または配送不能の時だけHerdr exact paneへ倒し、その事実を記録する。memberは迷ったら手を止め`BLOCKED`を返し、scope / touching / authorityを自己拡張しない。
8. admit後はactiveなlane attachmentのexact targetだけを監視する。Herdrではcaller paneをwaitせず`agent get`だけで再照合し、他targetは`agent wait`を有限timeoutで待ってから`agent get`する。`idle`だけをresource上のavailableとし、`done`単独では再割当しない。選外・未登録・departed・別Formationのagentを常時監視しない。
9. batch前後とlane state changeでcontrol pulseを行い、goal、lane、未ACK、ownership、安全なwork在庫、nextを確認する。goal未達でeligible workがある限りavailable memberを未割当でpulse越しに残さず、設計→契約確定→実装→review→統合→出荷の依存を満たしたcritical path上の次assignmentを提案する。下位agentの起動数をmember稼働数として数えず、dispatchやpollingだけでCommanderを稼働中とみなさない。後戻りしにくい判断・全laneへ波及する判断は他memberのGOか独立reviewのOKを経る。
10. 追加paneはownerの利用開始指示後だけadmitする。契約外repoは`EXTERNAL_REPO_REQUIRED`へ集約し、影響laneだけ停止する。
11. lane本人は`formation leave`で固定handoffを保存するが責任を解放しない。commanderは最新`CANDIDATE_READY`、検証・証跡、subordinate activityなし、対象laneの全assignment ID回収を確認して`formation release`する。member releaseはattachmentをdepartedへ進める。commander自身のassignment releaseは責任だけを解放し、close authorityのためattachmentをactiveに保つ。unexpected departureも同じrelease判定へ収束させ、commander authorityを自動移譲しない。
12. freeze後にacceptance、review、verification、Human Gate、excluded棚卸しをclose dossierへまとめる。不足があればreplan loopを続け、goal達成までcloseしない。close後のassignment / report / join / leave / release / 再closeは終端barrierで拒否する。

`formation status --id <formationId> --json`の`attention.nextActions`をjoin進行、`attention.pendingLeaves`をhandoff回収待ち、`lanes[]`をadmit後の責任状態の正本とする。laneは`unassigned / assigned / report_required / blocked / leave_requested / departed`を取り、assignment、latest report、subordinate activity、delivery statusを公開する。`issue_challenge`は未発行、`await_claim`は有効なclaim待ち、`reissue_challenge`は旧IDを再利用せず新challengeを発行、`ready`はadmit済みまたは解放済みを表す。公開statusはchallenge ID、receipt key、native session、local ledger pathを含めない。配送表示の`unconfirmed`は送達未確認であり、未送信や再送可能の証拠ではない。

Formationは参加membershipと物理lane attachmentまでを担う。admit後は同じ`laneId`を既存TGLの親lane identityとして渡し、各窓がTGL / PLD / subagent等を使って実装・検証・reviewを進める。TGL側へroster、challenge、receiptの状態を複製しない。

Formationは**その場だけの組織**である。最終操作から48hを超えて無操作なら、次に誰かが台帳をwrite-openした時点で行ごと解散する（`status` / `candidates`はread-only、`migrate`はschema操作なので掃かない）。判断・採否・証跡はclose時点でrepoの文書へ昇格しており、台帳が持つのは組織が動いている間だけ要るlane / challenge / receiptなので、`disbanded`のような終端状態を残さない。**closeし忘れを借金にしないための仕組みであり、closeを省いてよいという意味ではない**。goal達成の締めは引き続きcloseで行う。48hを超えて中断する見込みがある時は、解散を前提にhandoffをrepo側へ残す。

freezeは即時停止の事実ではなくbarrierである。司令塔が`freeze_requested`を記録し、各laneの受領または消失判定を回収して`frozen`へ遷移する。通知到着前に開始済みだった操作はin-flightとして記録し、巻き戻さず、重複操作だけを止める。

重複TGL、誤ったbase、touching / ownership競合、受入条件違反を検出した時は、commanderは影響laneを即時差し止められる。これは正式な品質稼働である。差分を破棄せず保全し、根拠、影響範囲、保全物、再開条件を記録し、無関係laneまで一括停止しない。

resource observationにはstatusと観測時刻を残し、古い観測、`unknown`、working / blockedを再配置可能とみなさない。sidebarの色や背景terminal数は補助表示でありavailabilityの根拠にしない。assignment候補が足りない時はpollingや重複reviewで稼働を装わず、未割当laneを`replan_required`として安全なworkを再発見する。何も無い場合だけ理由と再開条件付きの待機を記録する。提案はassignment確定ではなく、scope・ownership・authorityを再確認してdispatchする。

各memberは自laneの固定range、acceptance、touching、review boundaryを示し、TGLまたはAgent Roomへ独立reviewをdispatchできる。reviewerは親lane配下の外部資源であり、結果の採用、修正、再review、fan-inはmemberが行う。Commanderはreview発行を自分だけの直列queueへ集めず、cross-lane契約、採否、統合順序、global acceptanceへ集中する。

出荷は判断と操作を分ける。CommanderまたはHuman Gateが対象range、evidence、許可操作、停止条件を固定した後だけ、bounded Shipperへ決定済みのmerge / push / PR・CI監視・許可済みdeploy監視を委任できる。Shipperはdrift、conflict、evidence不足、Human Gate不足で停止し、設計変更、修正、rebase、gate回避、authority拡張を自己判断しない。capabilityとriskが合えば軽量modelを使えるが、agent名へ恒久固定しない。

## Current automation boundary

member-first、Commander mode、member-owned review、bounded ShipperはこのSkillが今すぐ従うagent-side contractである。

Domain / Applicationで実装済み:
- 実行中1件 + 外部review待ち1件のWIP上限。seamは`projectMemberCapacity` / `MemberExecutionFrame`。超過する`assign`は`lane_has_active_assignment`で拒否する。
- 外部review待ちだけで実行枠が空いているmemberへの次work候補。seamは`proposeNextWorkCandidates`。候補でありassignment確定ではない。
- Commander participation modeのstart contract / event / projectionへの耐久化。CLIは`--commander-mode`、`status --json`は`commanderParticipationMode`。不正値は`formation_start_input_invalid:commander-mode`。mode欠落は`director-only`へfail closedする。

未実装（現行CLIが自動強制すると推測しない）:
- Picker / Commanderへのeffective model・effort・tier snapshot
- 軽量Shipperの自動routing

model不明は`unknown`とし、実測値と観測時刻を記録する。未実装境界はowner指示、control pulse、手動assignmentで守る。後続実装は[ADR-0053](https://github.com/fujimogn/agent-room/blob/main/docs/adr/0053-formation-member-first-flow-and-bounded-shipping.md)とOpenSpec change `define-formation-member-first-flow`を参照する。

## Contract lookup

- start / admit / assign / leave / close時は[contract](references/contract.md)を読む。
- send / report / receipt / adapter選択時は[messaging](references/messaging.md)を読む。

SkillはFormationの意味契約を実行する。Domain/Application CLIの実装、ledger schema、Herdr plugin、cross-repo ProgramはこのSkillの責任範囲に含めない。
