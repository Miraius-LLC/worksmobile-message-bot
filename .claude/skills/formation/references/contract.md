# Formation contract

Formationはownerが明示した一つのgoalを、同じHerdr workspaceの選択rosterと一つのrepositoryで完走する一時編成である。workspaceに検出されたsessionは候補であり、rosterではない。

## Scope and contract fields

v1の編成規模はPairまたはSiteとし、commanderを含む2〜7 pane、1 Herdr workspace、1 repoに固定する。Soloは通常作業として扱い、cross-repoのProgramは別契約にする。`laneLimit`は2〜7の整数（contractsの`FORMATION_MIN_ROSTER_PANES` / `FORMATION_MAX_ROSTER_PANES`）で、開始時の選択roster数と一致させる。rosterと`laneLimit`はCommander 1 paneを含み、本文書でいう`member`はCommanderを除くため、member数は`laneLimit - 1`（最大6）である。Commander control laneを追加laneとして二重計上しない。

開始時に次を固定する。

```ts
interface FormationContract {
  formationId: string
  goal: string
  acceptanceCriteria: string[]
  workspaceId: string
  commanderAgentId: string
  goalControl: {
    globalGoalRef: string
    controlPulsePolicy: 'event-and-boundary'
  }
  capabilitySnapshotRef: string
  laneLimit: number
  childConcurrencyLimit: number
  repositoryScope: {
    mode: 'repo-local'
    repositories: readonly [RepositoryContract]
  }
  authority: {
    integrationOwner: string
    mainPush: 'allowed-by-repo-policy' | 'human-gate'
    deploy: 'human-gate'
  }
  decisionPolicy: { askOwnerWhen: DecisionClass[] }
}

interface RepositoryContract {
  repoName: string
  canonicalRemote: string
  gitCommonDir: string
  baseCommit: string
  writeRoots: string[]
}
```

CLI / ledgerに永続化する上記fieldに加え、agent-side execution policyとしてCommanderの参加modeをowner contractから固定する。

```ts
type CommanderParticipation = 'director-only' | 'director-and-implementer'
```

`director-only`はcontrol、統合、出荷判断だけを担い、実装assignmentを受けない。`director-and-implementer`もmemberへ割当可能なworkを先に使い、制御余力がある時だけ`commanderEligibility=bounded`のworkを受ける。現行start DTOはこのmodeを永続化しないため、ownerの現在の明示指示だけをagent-side SoTとし、modeが未指定、失われた、矛盾した、またはsession recoveryで証拠を再取得できない場合は`director-only`へfail closedする。各control pulseとhandoffはmodeとowner directive evidenceを再掲するが、ledgerが機械強制済みとは扱わない。後続実装ではstart contract / event / projectionへmodeを耐久化する。

`canonicalRemote`と`gitCommonDir`の両方を照合する。worktree path、repo名、symlink、nested Gitだけでは同一repoと判定しない。contract外repoの編集・worktree・実装委任は行わず、必要なら次の申請に集約する。

```text
EXTERNAL_REPO_REQUIRED
target repository:
reason:
expected files or interfaces:
impact on current repositories:
alternative without editing target:
verification and rollout needs:
```

## Roster, selection, and lane attachment

roster stateは次の順序で扱う。

```text
detected → proposed → selected → join_challenged → admitted → assigned
                    └→ excluded
working → report_required → available
             └→ blocked
             └→ departed
```

同一workspaceのdiscoveryはHerdr agent ID、tab / pane ID、agent kind、cwd / repo fingerprint、lifecycleなどの最小metadataに限る。ownerが選ぶまでtranscriptを読まず、prompt、native message、queue投入をしない。選外は理由付きで保持し、workspace mismatch、repository mismatch、窓数超過はstateとledger projectionに記録する。候補がcontract窓数と一致し、開始指示にaliasが含まれるなら追加質問なしでselectionへ進める。追加paneはownerの利用開始指示とscope指定の後だけ提案・admitする。

Formationの論理identityはlaneId、物理identityは`workspaceId + tabId + paneId + herdrAgentId`、配送属性は検証済みnative session IDまたはHerdr exact targetに分ける。

repository identityは`canonicalRemote + gitCommonDir + repoRoot`で照合する。**`headCommit`はjoin / claim / admit / assignment / reportのいずれの照合にも用いない**（実装でも比較していない）。同じcontract内の実装commitで進む観測値であり、challenge発行時とclaim時でHEADが動いていてもclaimは通る。**HEADのずれを理由にclaimを見送らない。**

```ts
interface LaneAttachment {
  formationId: string
  laneId: string
  workspaceId: string
  tabId: string
  paneId: string
  herdrAgentId: string
  agentKind: string
  nativeSessionId: string | null
  repositoryFingerprint: {
    canonicalRemote: string
    gitCommonDir: string
    repoRoot: string
    headCommit: string
  }
  challengeId: string
  boundAt: string
  lastVerifiedAt: string
  status: 'active' | 'excluded' | 'departed'
}
```

`displayAlias`は人間向けの一意な名だが、単独でattachmentや配送targetの根拠にしない。admit後のpane移動、agent再起動、pane再生成、native session変更は古いrouteを失効させる。復帰はreleaseの後に新しいlaneへ期限付きchallengeを発行して再admitする。challengeの`formationId`、`challengeId`、`issuedAt`、`expiresAt`、`consumedAt`、TTL、期限切れ・消費済み・旧Formation拒否は[messaging](messaging.md)のSoTに従う。

## Goal loop and control pulse

commanderはglobal goalとacceptanceを持ち、各laneの完了だけでglobal goalをcloseしない。

```text
goal / acceptance contract
  → plan and ownership → dispatch and implement → collect reports
  → independent review → integrate → whole-goal verification
  → unmet: replan / met: close
```

## Member-first hierarchy

選択・admitされた各member paneは、Formation内で独立した上位laneとassignment責任を持つ。安全なworkがあるmemberへの上位assignmentを、Commanderまたは他laneのsubagent起動より先に確定する。下位agent数をroster数、member稼働数、独立lane数へ算入しない。

```text
Formation
├─ Commander control lane（必須、実装参加はowner contract次第）
├─ member lane A（独立assignment）
│  └─ 必要なTGL / PLD / Agent Room / subagent
└─ member lane B（独立assignment）
   └─ 必要なTGL / PLD / Agent Room / subagent
```

各下位workはparent formation / lane / assignment、scope、authority、touching、child concurrencyを継承する。親memberはfan-in、重複防止、review結果の採用・修正・再review、最終報告を保持する。下位workを未割当memberの代替にした計画はdispatchせず、各memberの上位assignmentを再計画する。

### Pane capability snapshot boundary

割当判断にはagent kindだけでなく、paneのeffective model、effort、version付きpolicyから解決したtier / capabilities、source / certainty、観測時刻、有効期限が必要である。Picker選択時とassignment直前にfresh snapshotを再取得し、model切替、TTL失効、identity不一致、取得不能は`unknown`としてtier必須workへ推測配属しない。

snapshot未実装中の一次記録の読み方は、Claudeは`~/.claude/projects/<project>/<session>.jsonl`の`message.model`、Codexは`~/.codex/sessions/<date>/rollout-*-<session>.jsonl`の最新`turn_context`の`payload.model`と`payload.effort`（`session_meta`やconfig既定は権威にしない。実装は`src/formation/pane-capability-source.ts`）、Antigravityは`~/.gemini/antigravity-cli/log/cli-*.log`のmodel endpointを見る。読めない時だけ`unknown`とし、実測値と観測時刻を記録に残す。

現行Herdr / Formation metadataはagent kindとstatusを扱うが、このeffective model snapshotは未実装である。HerdrのTTL・sequence付きpane metadata tokenをagent integration / hookから報告できるかagent別conformanceするまで、terminal footerやagent名をauthorityにしない。目標contractとPicker表示は[ADR-0053](https://github.com/fujimogn/agent-room/blob/main/docs/adr/0053-formation-member-first-flow-and-bounded-shipping.md)を参照する。

control pulseはcommanderの実装batch前後、`BLOCKED` / `CANDIDATE_READY` / `DECISION_REQUIRED`受信時、Herdrのdone / idle / blocked / vanished変化時、timeout境界、integration / push / deploy / close直前に行う。毎回次を確認する。

1. global goalとacceptance criteriaの差分
2. 各laneのHerdr stateとFormation state
3. 未ACK報告・blocker・decision
4. touching / ownership / integration順序
5. available laneと安全なwork在庫
6. 次にcommanderが行う1アクション

緊急でない判断は、`decision id / question / choices / commander recommendation / affected lanes / waiting impact / reversible or irreversible`を一つのdecision digestへ集約する。迷いが無く根拠を示せる判断（指定漏れの訂正など）は即答してよいが、その根拠を報告に残す（`formation note`で対象laneへ台帳付きに届ける）。不可逆または全lane停止だけは直ちにownerへ尋ねる。Herdrのidleは、active assignment、required report、pending decision、roster admittedを満たすまでavailableの根拠にしない。

availability monitorの対象集合はactiveなlane attachmentだけである。開始前の候補検出ではworkspace metadataを列挙できるが、admit後は保存済みexact targetごとのHerdr `agent wait`を有限timeoutで並行待受し、state changeまたはtimeoutで`agent get`を再取得する。選外・未登録・別Formationのagentへwait / get / read / promptを広げない。観測はstatusと時刻を組にし、stale / unknownは再取得までavailableとしない。

### Work-conserving pulse

global goalが未達なら、control pulseはavailable laneと安全なwork候補を照合する。eligible workがあるlaneは、実装、blocker解消、検証、acceptance監査、統合準備、discoveryの順に一意な次assignmentを提案する。同じworkを複数laneへ割り当てず、提案だけでassigned扱いにせず、scope・ownership・authority確認後のdispatchで確定する。

eligible workが足りずavailable laneが残る場合、pulseを成功扱いにせず`replan_required`とする。commanderは安全なwork在庫を補充し、それでも候補が無い場合だけlaneごとの待機理由と再開条件を記録する。polling、同じreviewの重複、利用先の無い調査はwork在庫やlane稼働へ数えない。

Herdrがworking、観測がstale / unknown、または親laneの子作業がactive / unknownの場合はwork候補不足と分離し、`awaiting_resource`とする。非active attachmentは黙って破棄せずrejectionとして返すが、active laneの計画は継続する。active laneが1本も無い時だけ`invalid_input`とする。global観測windowの非有限・負値は全laneの前に拒否し、lane時刻の非有限・負値・未来値はfresh observationを求める。

commanderの監視、報告回収、review、統合、出荷判定は正式なworkである。`director-only`または`commanderControlActivity=active`の間は実装を提案しない。一方、`director-and-implementer`で`dispatched`または制御作業なしのavailableなcommanderには、候補側が`commanderEligibility=bounded`と明示したworkだけを提案する。同一workをmemberとcommanderの両方が担える時はmemberを先に使い、commanderの制御余力を残す。
`commanderEligibility=extended`は「司令塔へは割り当てない」ことを明示する拒否語彙であり、未設定と同じくfail closedにする。

### Stop-the-line quality action

重複TGL、base drift、touching / ownership競合、受入条件違反は差し止め対象である。commanderは`reason / affected lanes / preserved artifacts / resume condition`を記録し、対象laneの新規GREEN・commit・TGL進行・統合を止める。未commit差分は破棄せず保全し、canonical rangeの確定後に正しいbaseから再割当する。影響の無いlaneは継続し、Formation全体のfreezeと混同しない。この調査・保全・再開判定中のcommanderはbusyであり、追加実装を割り当てない。

## Assignment, review, and child scope

assignment成果は`CANDIDATE_READY`で提出できるが、commander ACK、independent review、integration acceptance、global acceptanceが揃うまで完了ではない。review capacityは既存Agent Roomの現在capacityに従い、Formation独自のcapacity SoTを作らない。review admissionは独立reviewer数とexecution slotの現実のsnapshotに従い、古い・取得不能な値を推測しない。

`formation ack`は`report_required`かつ最新reportが`CANDIDATE_READY`なら受理し、`formation release`だけが追加でsubordinate activityなし・verification・evidence refsを要求する。この差は成果受理とlane離脱を分けるため意図的である。

Commander → 上位member lane → 子agentの2層を基本とし、子作業は親のworkspace、repository、touching、authority、concurrency上限を継承する。下位から上位rosterへの自動登録、contract repo集合の拡張、未承認の統合権限移譲はしない。各memberは自laneからAgent RoomまたはTGLへ独立reviewをdispatchでき、Commanderへreview発行を直列集中させない。

上位laneは単機能に固定せず、capability snapshotで利用可能と確認したsubagent、TGL、PLD、MCP、Skill、modern CLI、CodeGraph / Graphifyのうちassignmentに必要な手段を選ぶ。すべてを毎回使うことは求めない。子作業のfan-in、重複防止、最終報告は親laneが担う。

目標契約ではmemberごとに自身が実行中のassignment最大1件と、外部review待ちで責任を保持するassignment最大1件を区別する。review待ちだけでmember自身がsafe checkpointにいる時は次の安全なworkを提案できる。現行Domainはlaneごとに単一active assignmentを持ち、`subordinateActivity=active|unknown`をlane全体の待機として扱うため、この再配置とWIP上限は自動強制されていない。実装完了までは手動assignmentで上限を守り、statusを実装済みのcapacity projectionとして解釈しない。

## Shipping delegation

出荷判断はCommanderまたはHuman Gateが保持する。判断後はreview済みrange、採用commit、review / verification evidence、許可操作、停止条件を固定したbounded Shipperへ、決定済みのmerge、push、PR / CI監視、許可済みdeploy監視を委任できる。

ShipperはFormation memberの代替ではなくCommander control lane配下の限定実行資源である。base / range drift、conflict、evidence不足、Human Gate不足ではfail closedでCommanderへ返す。設計変更、修正、rebase、gate回避、authority拡張は行わない。軽量modelはcapability、risk、availabilityがこの契約を満たす時だけ候補にできる。現行routingが自動選択すると推測しない。

## Event and ledger meaning

```ts
type FormationEventKind =
  | 'ASSIGNED' | 'ACK' | 'STARTED' | 'OWNERSHIP' | 'RED' | 'PROGRESS'
  | 'BLOCKED' | 'CANDIDATE_READY' | 'REVIEW_RESULT'
  | 'DECISION_REQUIRED' | 'CONTROL_PULSE' | 'LEAVE_REQUESTED'
  | 'HANDOFF_READY' | 'INTEGRATION_ACCEPTED'
  | 'INTEGRATION_REJECTED' | 'RELEASED'
```

roster discovery、selection、join challenge、consume、admitはDomain eventからroster projectionへ反映する。`CANDIDATE_READY`は成果提出であり、成果受理は司令塔の`formation ack`で確定する。receiptは送信成功後の送達確認だけを保持し、claim・ack・releaseでreceiptを再更新しない。未ACK数は未consumeかつ有効なchallengeと未terminal assignmentから算出する。送達未確認時の停止・再送判断は[messaging](messaging.md)に従う。

## Leave, departure, freeze, and close

leave要求はassignmentを消さない。assignmentのないlaneはreceipt後にreleaseできる。作業中laneは次のhandoffを出し、同じ`recover orphaned responsibility`経路で責任をcommanderへ回収する。

```text
current state:
touching paths:
commit and dirty state:
verification:
remaining work:
evidence refs:
```

freezeは`freeze_requested → frozen`のbarrierとして扱う。`freeze_requested`以後は新規dispatch / send / integrationを発行せず、各laneのfreeze受領、受領前からのin-flight操作、dirty / commit / pending runをcheckpointへ回収する。通知の配送前またはlaneのfreeze ACK前に開始済みだった操作は違反やrollback対象にせずin-flightとして保全し、同じ操作の再発行だけを止める。全admitted laneの受領または消失判定が揃った時に`frozen`とする。frozen中はread-only status、report回収、owner decisionだけを許す。

全lane idleでもcloseしない。close dossierにはcontract、rosterとexcluded理由、eventとreceipt、採用range、ownership、review / verification、残Human Gate、未完了事項を含め、acceptanceと証跡が説明できる時だけ`INTEGRATION_ACCEPTED`としてcloseする。不足時は`INTEGRATION_REJECTED`またはreplanへ戻す。

### 48h automatic disband and suspension handoff procedure

Formation台帳は最終操作から48hを超えて無操作のまま経過すると、次回台帳のwrite-open操作時に行ごと自動解散（レコード削除）される。この自動解散はcloseし忘れを借金にしないための安全弁であり、close手続きの省略ではない。

48hを超えて作業を中断する見込みがある場合、司令塔は台帳消失に備えて以下の手順でhandoffを記録し、次回再開時の司令塔へ確実に引き継ぐ（藤井決定 2026-09-11: 新規の永続化機構を作らず、既存のhandoff置き場と起動フックを活用する）。

1. **保存先**: `~/Develop/.agent-room/<project>/handoffs/`
   - `session-start-dispatch` がセッション開始時に未消化（`status: open`）のファイルを自動検知・列挙する既存経路に一致させる。
   - 命名規則: `<YYYY-MM-DD>-formation-<formationId>-handoff.md`
2. **残す内容**:
   - YAML frontmatter（必須。`agent-room-ops` の Handoff Documents 規約に準拠）:
     ```yaml
     ---
     status: open
     date: YYYY-MM-DD
     resolved_commit:
     ---
     ```
   - 本文の必須記録項目:
     - `formationId`、goal、acceptance criteria
     - 全laneの状態一覧（`laneId`、担当agent、pane、状態、assignmentId、最新report）
     - `touching paths`: 変更対象・接触中のファイル一覧
     - `commit and dirty state`: 各worktreeのHEAD commit SHA、branch名、未コミット変更（dirty）の有無とworktreeパス
     - `verification`: 実施済みテスト・検証証跡、未検証項目
     - `remaining work`: 未着手・未完了のassignment、次に割り当てるべきwork在庫
     - `evidence refs`: close dossier下書き、レビューログ、PR/ブランチ等の参照先
3. **回収確認者**: **次に起動した司令塔（`lane_commander`）**
4. **回収完了の判定基準**:
   - 次に起動した司令塔が `session-start-dispatch`（または `rg -l '^status: open$' ~/Develop/.agent-room/<project>/handoffs/`）で未消化handoffを検知・確認する。
   - 前回のFormationが台帳上で自動解散されていることを確認し、残存worktree・ブランチ・コミット状態を点検する。
   - 残存作業を新しいFormationのgoal/assignmentとして再編するか、main統合・TODO更新を完了する。
   - 引き継ぎ・着地が完了した時点で、司令塔がhandoffファイルのfrontmatterを `status: resolved` に更新し、`resolved_commit: <SHA>` に着地先コミットを記録する。
   - frontmatterが `resolved` となることで未消化列挙から外れ、回収完了として確定する。

Formationのroster外にいる実装者は、ownerが明示したdogfood範囲に限り`external canary controller`として状態確認、限定probe、異常系再現、安全補正を司令塔へ依頼できる。通常laneの割当、優先順位、freeze解除、review admission、統合、push、goal closeの権限は持たない。probeは目的、対象、期待結果、停止条件を必須とする。

## Owner questions

規則で一意に決まるworkspace mismatch、repository mismatch、窓数超過による除外、十分なhandoff後のrelease、既存assignmentの回収はownerへ尋ねない。次だけを影響laneをまとめた一通で尋ねる。

- 不足情報が結果を変える時のgoal、acceptance、lane数、alias、scope。
- 重複alias、候補が契約窓数を超える場合のselection。
- 追加paneの利用開始、laneLimit / ownership変更。
- dirty worktree、未共有commit、残作業の回収方法が一意でないleave / departure。
- commander_missingからの再開、不可逆判断、全lane停止。
- `EXTERNAL_REPO_REQUIRED`の別契約許可。

質問にはquestion、choices、推奨、affected lanes、waiting impact、可逆性を含める。
