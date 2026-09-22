# Formation contract

Formationはownerが明示した一つのgoalを、同じHerdr workspaceの選択rosterと一つのrepositoryで完走する一時編成である。workspaceに検出されたsessionは候補であり、rosterではない。判断hookとroutingはSKILL.md、実装seamのfile:lineは[implementation-map](implementation-map.md)。

## Scope and contract fields

v1の編成規模は最小のPair（commander + member 1 = 2 pane）から最大のSite（commander + member 10 = 11 pane）までとし、1 Herdr workspace、1 repoに固定する。1 paneのSoloは通常作業として扱い、cross-repoのProgramは別契約にする。中間の呼称は置かず、規模はpane数で言う。`laneLimit`は2〜11の整数（contractsの`FORMATION_MIN_ROSTER_PANES` / `FORMATION_MAX_ROSTER_PANES`）で、開始時の選択roster数と一致させる。rosterと`laneLimit`はCommander 1 paneを含み、本文書でいう`member`はCommanderを除くため、member数は`laneLimit - 1`（1〜10）である。Commander control laneを追加laneとして二重計上しない。

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

`director-only`はcontrol、統合、出荷判断だけを担い、実装assignmentを受けない。`director-and-implementer`はmemberへ割当可能なworkを先に使い、制御余力がある時だけ`commanderEligibility=bounded`のworkを受ける。start contract / event / projectionは`commanderParticipationMode`を耐久化する。CLIは`--commander-mode`でハイフン値だけ受理し、欠落は`director-only`へfail closed、実装assignは`commander_implementation_forbidden`。seamは[implementation-map](implementation-map.md)。

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

同一workspaceのdiscoveryは最小metadataに限る。ownerが選ぶまでtranscript / prompt / native message / queue投入をしない。選択後もmember・commanderへの連絡はagent-room CLIだけを使い、直接native送信を許可したとは扱わない。選外は理由付きで保持する。候補がcontract窓数と一致し開始指示にaliasが含まれるなら追加質問なしでselectionへ進める。追加paneはownerの利用開始指示とscope指定の後だけ提案・admitする。

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

Herdrのterminal titleやagent aliasのような人間向け表示名は一意とは限らず、単独でattachmentや配送targetの根拠にしない（台帳が保持するのは上の`LaneAttachment`のfieldだけで、表示名は持たない）。admit後のpane移動、agent再起動、pane再生成、native session変更は古いrouteを失効させる。復帰はreleaseの後に新しいlaneへ期限付きchallengeを発行して再admitする。challengeのTTLとconsume規則は[messaging](messaging.md)のSoTに従う。

`status`の`attention.nextActions[]`が返す4値は、`issue_challenge`（challenge未発行）、`await_claim`（有効なclaimを待っている）、`reissue_challenge`（旧IDを再利用せず新しいchallengeを発行する）、`ready`（admit済みまたは解放済み）である。公開statusはchallenge ID、receipt lookup key、native session ID、git common dir、cwd、local ledger pathを含めない。

## Goal loop and control pulse

commanderはglobal goalとacceptanceを持ち、各laneの完了だけでglobal goalをcloseしない。close dossierでは「規約適用開始（採用日: 2026-09-17、main上の基準commit: `434fa51df6caa04546f10107d13bb73963813bae` のS6規約を当Formationが採用した時点）以降、CLI経由でない連絡を行っていない」を根拠付きで確認する。採用日時を記録し、基準点を後から動かして違反を対象外にしない。適用開始前の違反と是正の事実も消さずclose dossierへ残すが、その過去の事実だけで本条件を未充足にしない。適用開始以降の違反・不明は記録して未充足のまま扱う。degradedの棚卸しもclose dossierへ残す（件数・理由・入力衝突が復活し得た区間、観測不能範囲）。CLIによる欠測時の旧経路選択は手動迂回違反ではなく、記録して続行し、発生だけでclose不可にしない。件数ゼロを受入条件にせず、未観測をゼロにしない。これはagent側の受入確認であり、自動検証済みとみなさない。

```text
goal / acceptance contract
  → plan and ownership → dispatch and implement → collect reports
  → independent review → integrate → whole-goal verification
  → unmet: replan / met: close
```

## Member-first hierarchy

選択・admitされた各member paneは独立した上位laneとassignment責任を持つ。安全なworkがあるmemberへの上位assignmentを、Commanderまたは他laneのsubagent起動より先に確定する。下位agent数をroster数、member稼働数、独立lane数へ算入しない。

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

割当判断には (1) AA **tier**（Picker・model snapshot）と (2) pane **method** 観測（`subagents` / `tgl` / `modern_cli` 等）が必要で、両者は別語彙。Picker選択時とassignment直前にfresh snapshotを再取得し、model切替・TTL失効・identity不一致・取得不能は`unknown`としてtier必須workへ推測配属しない。一次記録のpathは[implementation-map](implementation-map.md)。`assign --allowed-method`は許可であって保有要求ではない。確認済み`unavailable`だけmutation前に拒否し、`unknown` / `not_observed`は通す。Shipper routingだけ保有を厳格に見る。terminal footerやagent名をauthorityにしない。

control pulseはbatch前後、`BLOCKED` / `CANDIDATE_READY` / `DECISION_REQUIRED`、Herdrのdone / idle / blocked / vanished、timeout、integration / push / deploy / close直前に行う。毎回、goal差分、lane state、未ACK、ownership、安全なwork在庫、次の1アクションを確認する。緊急でない判断はdecision digestへ集約する。不可逆または全lane停止だけは直ちにownerへ尋ねる。Herdrのidleは、active assignment、required report、pending decision、roster admittedを満たすまでavailableの根拠にしない。

availability monitorの対象はactiveなlane attachmentだけである。admit後は保存済みexact targetごとのHerdr `agent wait`を有限timeoutで待ち、state changeまたはtimeoutで`agent get`する。選外・未登録・別Formationへ広げない。観測はstatusと時刻を組にし、stale / unknownは再取得までavailableとしない。

### Work-conserving pulse

global goalが未達なら、available laneと安全なwork候補を照合する。eligible workがあるlaneへ、実装→blocker解消→検証→acceptance監査→統合準備→discoveryの順に一意な次assignmentを提案する。提案だけでassigned扱いにせず、scope・ownership・authority確認後のdispatchで確定する。pollingや同じreviewの重複はwork在庫へ数えない。Herdrがworking、観測がstale / unknown、子作業がactive / unknown、attachmentが非activeのlaneはavailableとして数えない。eligible workが足りずavailable laneが残るなら再計画する。

**これは司令塔側の判断規約であって、CLIがこの判定や専用のrejection codeを返すわけではない。** この判定についてCLIが出すのは`status --json`の`attention.nextWorkCandidates[]`だけで、未releaseのassignmentを持ち`projectMemberCapacity`のframeが`safe_checkpoint`のlaneを`{laneId, holdingAssignmentId, frame}`で並べる（`packages/application/src/formation-attention.ts`の`proposeNextWorkCandidates`、`packages/contracts/src/formation.ts`の`formationNextWorkCandidateSchema`）。

`director-only`または`commanderControlActivity=active`の間は実装を提案しない。`director-and-implementer`でavailableなcommanderには`commanderEligibility=bounded`のworkだけを提案し、memberを先に使う。`commanderEligibility=extended`は司令塔へ割り当てない拒否語彙であり、未設定と同じくfail closedにする。

### 大きなrosterでの監視と割当

memberは最大10になる。以下は2026-09-16のwave5（司令塔 + 6 member）で実際に踏んだ3点で、memberが増えるほど重くなる。**10 memberでの実績はまだ無い**ので、ここは実例から引いた運用方針であって検証済みの手順ではない。

**1. paneのidle / doneは作業完了の証拠ではない。** 台帳の`workStatus`は`assigned`のままで報告だけが来ないことがある。同日、司令塔はpaneの状態ではなく**laneのworktreeのcommitとtreeのclean**を見に行って2回気付いた。完了判定はpane状態ではなく、laneが報告した成果（`CANDIDATE_READY`のcommitと検証）と、必要ならそのworktreeの実物で行う。`agent get` / `agent wait`はresource上のavailability（次を渡してよいか）を見るためのもので、assignmentの終端ではない。

**2. 報告の無いlaneは自分から拾う。** 待っていても来ない。台帳側の手掛かりは3つで、いずれも**新しいlane状態ではなく`assignments` / `assignmentReports` / 配送receiptからの導出**である。

| 出るもの | 意味 | 起点と閾値 | どこに出るか |
|---|---|---|---|
| `attention.silentAssignments[]` | 割り当てたが一度も報告が無い（member側が詰まっている） | **割当**（`assignedAtEpochMs`）から10分超（`SILENT_ASSIGNMENT_THRESHOLD_MS`） | write commandの結果 |
| `attention.awaitingAck[]` | 報告が来て司令塔の応答待ち（commander側が詰まっている） | 閾値なし | write commandの結果 |
| `attention.unstartedAssignments[]` | 配送済みだが報告が無い | **最新の配送**から5分超（`UNSTARTED_ASSIGNMENT_THRESHOLD_MS`） | `status` |

**出る場所が違うので両方を見る。** `silentAssignments`と`awaitingAck`は`deriveCommanderAttention`が`status: accepted`と`duplicate`のcommand結果へ付けるもので、`rejected`にも`status`にも載らない（別laneを`ack`した時にも目に入る形にしないと、沈黙は見に行った人にしか見えないという設計）。`unstartedAssignments`は逆に`status`の`unstarted_assignments`行と`--json`にだけ出る。報告が1件でもあるlaneと未配送のassignmentは`unstartedAssignments`に出ない（配送失敗はreceiptが無いことで既に見える）。

⚠️ 人間向け出力の文言は`⚠ <lane>: <assignment> を配送してから N 分、報告がありません`だが、`silentAssignments`のNは**割当**からの経過である。未配送のassignmentでも「配送してから」と表示され得るので、配送の有無はreceiptで確かめる。

pulseごとにこの3つを読み、該当laneへは`note --deliver`で催促するか、詰まりが構造的なら`cancel`して割当を組み直す。laneが増えるほど「全laneを順に見る」は現実的でなくなるので、**この3つに載ったlaneから触る**のを既定にする。

**3. touchingは最初から広めに列挙する。** `note`はscope・受入条件・touchingを変えないので、touchingの漏れは`note`では広げられない。広げるには`cancel`してから同じlaneへ`assign`し直す往復になり（active assignmentがある間の`assign`は`lane_has_active_assignment`で拒否される）、そのたびにmemberは待つ。

- 割当側: 触る可能性のあるpathを最初から列挙する。`--touching`はrepo相対のファイルpathで、末尾スラッシュとディレクトリ指定は使えない。
- member側: touching外のpathが要ると分かっても自分で広げない。**他に進められる作業があれば`RED`で必要なpathを名指しして報告し、作業は続ける。** 止まってしまう時と、承認が要る・不可逆な分岐だけが`BLOCKED`。
- 司令塔は`RED`で挙がったpathを次の`cancel` → `assign`へまとめて入れる。1件ずつ往復しない。

### Stop-the-line quality action

重複TGL、base drift、touching / ownership競合、受入条件違反は差し止め対象である。`reason / affected lanes / preserved artifacts / resume condition`を記録し、対象laneの新規GREEN・commit・TGL進行・統合を止める。未commit差分は破棄せず保全する。影響の無いlaneは継続し、Formation全体のfreezeと混同しない。調査中のcommanderはbusyであり、追加実装を割り当てない。

## Assignment, review, and child scope

liveの`agent-room` CLIはruntime checkout（`~/Develop/.agent-room-runtime`）で動くため、mainへのCLI修正は`agent-room runtime deploy`までliveへ届かない。

assignment成果は`CANDIDATE_READY`で提出できるが、commander ACK、independent review、integration acceptance、global acceptanceが揃うまで完了ではない。review capacityは既存Agent Roomの現在capacityに従い、Formation独自のcapacity SoTを作らない。review admissionは独立reviewer数とexecution slotの現実のsnapshotに従い、古い・取得不能な値を推測しない。

`formation ack`は`report_required`かつ最新reportが`CANDIDATE_READY`なら受理し、`formation release`だけが追加でsubordinate activityなし・verification・evidence refsを要求する。この差は成果受理とlane離脱を分けるため意図的である。

`formation report`の`--assignment-id`は届いたassignment IDを使う。cancel済みID宛てreportは台帳のactive assignmentに付かない。再発行したら`formation note`で新IDを伝え、それでも旧IDで`CANDIDATE_READY`が来たら実物検証してcherry-pickし、新IDは理由付きでcancelする。

Commander → 上位member lane → 子agentの2層を基本とし、子作業は親のworkspace、repository、touching、authority、concurrency上限を継承する。下位から上位rosterへの自動登録、contract repo集合の拡張、未承認の統合権限移譲はしない。各memberは自laneからAgent RoomまたはTGLへ独立reviewをdispatchでき、Commanderへreview発行を直列集中させない。

上位laneは必要な手段だけを選ぶ。fan-in、重複防止、最終報告は親laneが担う。

memberごとに自身が実行中のassignment最大1件と、`CANDIDATE_READY`後のACK待ち最大1件を区別する。seamは`projectMemberCapacity` / `MemberExecutionFrame`。`executing` / `wip_full` / `review_returned`のlaneへ追加`assign`すると`lane_has_active_assignment`で拒否する。ACK待ちだけで実行枠が空いているlaneは`safe_checkpoint`になり、次の安全なwork候補になれる（`proposeNextWorkCandidates`）。statusの`attention.memberCapacities`を実装済みのcapacity projectionとして読む。

assignment運用の前提4点はSKILL.md Workflow 7に同じ。

## Shipping delegation

出荷判断はCommanderまたはHuman Gateが保持する。判断後だけbounded Shipperへ決定済みのmerge、push、PR / CI監視、許可済みdeploy監視を委任できる。Shipperはmemberの代替ではなくcontrol lane配下の限定実行資源である。drift、conflict、evidence不足、Human Gate不足ではfail closed。設計変更、修正、rebase、gate回避、authority拡張は行わない。適格条件は検証済み`modern_cli`のみ（AA tierは問わない。2026-09-16 藤井決定、案 C）。手順は`docs/runbook/formation-shipping.md`。seamは[implementation-map](implementation-map.md)。

罠3点: (1) trusted runtimeが受理するcanary refは`refs/heads/canary/ship-20260911`固定（別名はrelease拒否）。(2) verification fileはhead SHAを引用する（`citesHead`）。(3) method観測は60秒で失効するため、`method-probe && ship`を連続実行する。

## Event and ledger meaning

`formation report --event`が受理するのは`STARTED` / `RED` / `BLOCKED` / `CANDIDATE_READY`の4つだけである（`packages/contracts/src/formation.ts`の`eventKind` enum、`agent-room formation report --help`）。

台帳へ積まれるDomain eventはこれとは別語彙で、次の20種である（`packages/domain/src/formation*.ts`）。

```text
FORMATION_STARTED / ROSTER_SELECTED / ROSTER_JOIN_CHALLENGED
JOIN_CHALLENGE_ISSUED / JOIN_CHALLENGE_CONSUMED / JOIN_CHALLENGE_EXPIRED
LANE_ATTACHMENT_CREATED / ROSTER_ADMITTED / FORMATION_ROSTER_RESEATED
FORMATION_ASSIGNMENT_CREATED / FORMATION_ASSIGNMENT_REPORTED
FORMATION_ASSIGNMENT_ACKNOWLEDGED / FORMATION_ASSIGNMENT_CANCELED
FORMATION_ASSIGNMENT_RELEASED / FORMATION_CHILD_WORK_DISPATCHED
FORMATION_CHILD_WORK_COMPLETED / FORMATION_NOTE_RECORDED
FORMATION_LEAVE_REQUESTED / FORMATION_LANE_RELEASED / FORMATION_CLOSED
```

`ACK` / `OWNERSHIP` / `PROGRESS` / `REVIEW_RESULT` / `DECISION_REQUIRED` / `CONTROL_PULSE` / `HANDOFF_READY` / `INTEGRATION_ACCEPTED` / `INTEGRATION_REJECTED` / `RELEASED`は本skillが文中で使う語彙であり、CLIやschemaが受理する値ではない。

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

freezeは`freeze_requested → frozen`のbarrierである。以後は新規dispatch / send / integrationを発行せず、受領前のin-flightは保全して再発行だけを止める。全admitted laneの受領または消失判定が揃った時に`frozen`。frozen中はread-only status、report回収、owner decisionだけを許す。

全lane idleでもcloseしない。close dossierにはcontract、rosterとexcluded理由、eventとreceipt、採用range、ownership、review / verification、残Human Gate、未完了事項を含め、acceptanceと証跡が説明できる時だけ`INTEGRATION_ACCEPTED`としてcloseする。不足時は`INTEGRATION_REJECTED`またはreplanへ戻す。

closeのDomain拒否: commander以外のactive attachmentが残ると`formation_close_incomplete` / `active_lanes`。先に全memberを`formation release`する。`--excluded-candidate`は1引数ずつ渡し、start時の`excludedCandidateIds`から`reseat --add`済みを除いた集合と一致しなければならない。複数IDを1引数に結合すると`formation_close_incomplete`。`--remove`で外した候補は除外集合へ戻さない。空なら付けなくてよい。

`--adopted-range`は**40桁full SHAの`<sha>..<sha>`形式だけ**を受ける（`packages/contracts/src/formation.ts`の`adoptedRangeSchema`）。短縮SHA・空文字・`...`・片側欠落・大文字は拒否される。**統合済みかどうかは検査しない**ので、**remote到達の確認はcloseの前に司令塔が`git ls-remote`で行う**。形式検査は空文字列的な申告を抑止するだけで、統合の証明ではない。

### 48h automatic disband and suspension handoff procedure

Formation台帳は最終操作から48h超の無操作のあと、次回write-open時に行ごと自動解散する（`FORMATION_INACTIVITY_TTL_MS`。ちょうど48hは残す）。掃除を飛ばすのは`status`と`migrate`だけで、`candidates`はそもそも台帳を開かないため届かない。closeし忘れを借金にしない安全弁であり、closeの省略ではない。

48h超の中断見込みがある時、司令塔は既存handoffへ退避する（藤井決定 2026-09-11: 新規機構は作らない）。

1. **保存先**: `~/Develop/.agent-room/<project>/handoffs/`（`session-start-dispatch`が`status: open`を列挙する既存経路）。ファイル名は`<YYYY-MM-DD>-formation-<formationId>-handoff.md`。
2. **残す内容**: frontmatterは`status: open` / `date` / `resolved_commit`。本文はleave templateの6項目に加え、`formationId`、goal、acceptance、全lane状態（laneId、担当agent、pane、状態、assignmentId、最新report）。
3. **回収確認者**: 次に起動した司令塔（`lane_commander`）。
4. **回収完了**: 未消化handoffを検知し、前回Formationの自動解散とworktree状態を点検し、残作業を新しいFormationへ再編するかmain統合・TODO更新を終えた時点で、frontmatterを`status: resolved`、`resolved_commit: <SHA>`にする。

## Roster reseat and disband

reseatとdisbandはactive commanderだけが実行する。CLIは現在のHerdr paneがcommander候補のactive attachmentであることをfresh照合してから、commander actorとしてApplicationへ渡す。どちらも`--command-id`、`--herdr-session`、`--expected-revision`、`--reason`を必須とし、欠ければ`formation_<action>_input_invalid:<欠けた項目>`で止まる。revisionが古ければ`revision_conflict`で拒否される。

### reseat

```bash
agent-room formation reseat --id <formationId> --command-id <id> --expected-revision <rev> \
  --add <pane> --remove <pane> --reason "<理由>" --herdr-session <session> --json
```

- `--add` / `--remove`は複数回指定でき、少なくとも一方が要る。1 commandで一度に判定し、どれかが拒否されれば何も変わらない。paneは台帳を書く前にHerdrから再観測し、見つからなければ`formation_reseat_candidate_not_found:<pane>`。
- 除去の拒否: `candidate_not_selected`、`duplicate_candidate`、`commander_not_removable`、`reseat_candidate_attached`、`lane_has_unrecovered_assignment`。稼働中memberを外す時は先に`release`してattachmentをdepartedにする。除去した候補の未消費join challengeは`JOIN_CHALLENGE_EXPIRED`になり、旧challengeではadmitされない。
- 追加の拒否: `duplicate_candidate`、`workspace_mismatch`、`repository_mismatch`、いま選択中の候補または`status=active` attachmentと同じ物理identity（`duplicate_attachment_identity`）。`departed`と既に外した候補のidentityは照合しない。release → `--remove` → `--add`で同じpaneを戻せる。
- laneLimitは新しい選択集合の大きさになる。2〜11を外れれば`invalid_lane_limit`。追加はadmitではない。先にreseatし、そのpaneへ新しい`challenge`→`claim`する。

**同じpaneのagent交代はreseatを使わない。** candidate IDはpane単位で、paneは選択集合に残っている。止まったassignmentを`cancel`し、旧laneを`release`して、同じpaneへ新しいlane IDで`challenge`を発行し、新しいagentが`claim`する。

### disband

```bash
agent-room formation disband --id <formationId> --command-id <id> --expected-revision <rev> \
  --abandon <assignmentId> --abandon <assignmentId> --reason "<理由>" --herdr-session <session> --json
```

- **closeとの使い分け**: 受入条件を満たしたら`close`。満たさないまま止める時だけdisband。
- `--abandon`は直前`status --json`の`lanes[].assignment`から、`released`でないIDを**全件そのまま**並べる。1件でもずれれば、または最新reportが`subordinateActivity: active`なら、`disband_unrecovered_assignment`。
- 実行順: handoffを`disband_state: unconfirmed`で書く（書けなければ`disband_handoff_unavailable`、行は消さない）→ IMMEDIATE transactionで全行削除（eventは追記しない。48h自動解散と同じ関数）→ 削除をcommitした試行だけがhandoffを`committed`へ書き換える。CAS競合・再判定拒否なら自分が書いたhandoffだけを消して拒否する。SQLITE_BUSYは`storage_failure`。成功時は`handoffPath`を返し、以後の`status`は`formation_not_found`。
- **削除後に`committed`書き換えだけ失敗すると、Formationは消えているのに結果は`disband_handoff_unavailable`になる。** 拒否されたら再実行前に`status`を読む。`formation_not_found`なら削除済みとして回復手順へ進む。
- 同じcommand-idの再実行: Formationが残っていれば新しい試行。無く同じcommand-idの`committed`があれば`duplicate`、`unconfirmed`しか無ければ`disband_handoff_unconfirmed`（pathは返さない。`rg -l 'command_id: <id>'`）。payloadが違えば`command_id_conflict`。

### disband handoffの回復

置き場とfrontmatterは48h手順と同じで、ファイル名は`<date>-formation-<formationId>-handoff-<token>.md`、frontmatterに`command_id` / `payload_digest` / `disband_state`が加わる。`session-start-dispatch`は`status: open`として列挙する。`unconfirmed`は自動で`committed`へ昇格させない。次の司令塔は同じFormation IDのhandoffをまとめ、**上から順に最初に当てはまった行**で判断する。

1. `committed`が1本ある: それを回収する。同じFormationの`unconfirmed`はすべて削除をcommitできなかった試行の残骸なので、`status: resolved`にして閉じる（`resolved_commit`は空でよい）。
2. `committed`が無く、Formationがまだ台帳にある: どの試行も削除していない。`unconfirmed`をすべて閉じる。
3. `committed`が無く、Formationが無く、`unconfirmed`が1本だけ: それを回収する（勝った試行は削除前に自分のファイルを書くので、1本ならそれが勝者）。
4. `committed`が無く、Formationが無く、`unconfirmed`が複数: 自動で選ばず、各ファイルの放棄assignmentと理由を読んで、ownerかcommanderが採る1本を決め、残りを閉じる。

`committed`が2本以上あれば実装の不具合として回収を止め、報告する。

roster外の実装者は、ownerが明示したdogfood範囲に限り`external canary controller`としてprobeを司令塔へ依頼できる。通常laneの割当・freeze解除・統合・push・closeの権限は持たない。

## Attachment freeze and stuck pane

台帳へ書くcommandは、実行したpaneのattachmentをHerdrの再観測で照合してから通す。照合規則は`LaneAttachment`と同じで、`nativeSessionId`が`null`のattachmentだけが`terminal_id`一致を要求する（`hasMatchingHerdrAttachmentIdentity`）。照合が外れた経路はまとめて止まるので、単発の失敗ではなく**同時に複数の操作が止まる形**で現れる。2026-09-16に次の2件が実際に起きた（2件目のCLI側は`e8391109`で修正済み。本節は修正後の挙動で書いている）。

### terminal_id再発行で台帳が凍結する

Herdr serverが再起動すると、同じpane・同じagent sessionのまま`terminal_id`が再発行される。`nativeSessionId`を観測済みのattachmentはworkspace / tab / pane / agent種別 + native session IDで照合するので生き残る。**`nativeSessionId`が`null`のattachmentは今も`terminal_id`一致を要求するので、再発行と同時に失効する。**

- member laneが失効: そのpaneからの`report` / `leave` / `dispatch-child-work`が`formation_<action>_context_invalid`で止まる。`assign` / `note`は宛先attachmentもfresh照合するので、**commanderが生きていてもそのlane宛だけが**`formation_assign_target_invalid` / `formation_note_target_invalid`で止まる（`:lane_not_attached`はactive attachment recordが無い別症状）。
- commander laneが失効: `assign`（`formation_assign_context_invalid:commander_route_mismatch`）を先頭に`note` / `ack` / `cancel` / `release` / `reseat` / `disband` / `close`が全部止まり、台帳を進める経路が無くなる（2026-09-16のwave4で7 lane同時に発生）。
- 予防: `formation claim`へ`--native-session <id>`を渡す。**省略・`-`・空白だけ、はいずれも同じ扱い**で、Herdrからの生観測へfallbackする（`-`は明示的なnull指定ではない）。生観測が値を返せない時に`null`のまま保存される（`src/cli/commands/formation.ts`のclaim分岐、`src/cli/commands/formation.test.ts`「claim native sessionと再起動脆弱性を固定する」の表）。明示した値は前後を`trim`してから保存される（`required()`）。ただし再照合が突き合わせるのは保存値と**再観測時のlive `agent_session`**なので、値を書けば再起動に耐えるわけではない。claim直後に下の突き合わせで`nativeSessionId`が入ったことを確認する。

**切り分け** — `status --json`はnative sessionも`herdrAgentId`も公開しない。台帳を直接読んで`herdr agent list`と突き合わせる。

```bash
sqlite3 -cmd '.timeout 8000' "$AGENT_ROOM_LEDGER_ROOT/$AGENT_ROOM_LEDGER_DB" \
  "select state_json from formation_streams where formation_id='<formationId>';" \
  | jq -c '.laneAttachments[] | {laneId, paneId, herdrAgentId, nativeSessionId, status}'

herdr --session <herdrSession> agent list \
  | jq -r '.result.agents[] | [.pane_id, .terminal_id, .agent, (.agent_session.value // "-")] | @tsv'
```

`<herdrSession>`はFormationの各commandへ渡している`--herdr-session`と同じ値を使う。Formation実装も常にsessionを明示して観測するので（`herdr-start-facts.ts`の`['herdr', '--session', session, 'agent', 'list']`）、既定sessionに任せると別sessionを見て突き合わせが成立しない。

同じpaneの行で`herdrAgentId`と`terminal_id`が食い違い、かつ`nativeSessionId`が`null`なら原因はこれである。`nativeSessionId`が入っていて`agent_session.value`と一致するなら別の原因（repository fingerprint不一致、pane消失、`--pane`の取り違え）を疑う。sqliteはlock中に空を返すので、**出力が空なら結論を出さずに引き直す**。

**復旧** — commander attachmentが生きているかで分かれる。

1. member laneだけ失効: `cancel` / `release` / `ack`はcommander paneのattachmentを照合するので通る。止まったassignmentを`cancel`し、laneを`release`し、同じpaneへ新しいlane IDで`challenge`→`claim --native-session <id>`する（「同じpaneのagent交代」と同じ経路）。
2. commander attachmentも失効: 台帳を進める経路が無い。`challenge`だけはowner actorで動き既存attachmentを照合しないが、失効した行が`active`のまま残るので、同じpaneへ新laneを足しても`paneId`一致の検索が古い行を先に拾い得る（2026-09-16時点で未検証。これを復旧経路として当てにしない）。成果をgitから回収し、handoffを手で書いてFormationを組み直す。台帳の行を手で消さず、48h automatic disbandに任せる。

### 閉じたpaneのlaneをrosterから外す

`reseat`は`--add` / `--remove`の候補を台帳へ書く前にHerdrから再観測する。**除去候補のうち、その候補のchallengeに紐づくattachmentが全て`departed`のものだけはlive観測を省く**（`e8391109`）。`active`または`excluded`なattachmentを持つ候補と、attachmentが1件も無い候補（selectedだがまだclaimしていない）は従来どおりlive観測が要る。

- **順序が全て**: `release`でattachmentを`departed`にしてから`reseat --remove <pane>`する。この順なら**paneを閉じた後でも外せる**。満員（11枠）で新memberを入れる時は**先に`--remove`だけを出して10へ落とし、次のcommandで`--add`する**。満員のまま`--add`を出すと`invalid_lane_limit`で拒否される（laneLimitは判定後の集合で見るので1 commandでの`--remove` + `--add`も理屈上は通るが、検証されている順序は2 command）。
- `release`を先にせずpaneを閉じると外せない。activeなattachmentを持つ候補は`--remove`でもlive観測が要り、paneが消えていると`formation_selected_pane_not_found`で止まる。この拒否は`resolveHerdrFormationStartFacts`のmissing pane判定（`herdr-start-facts.ts`）で出るもので、CLI自身の`formation_reseat_candidate_not_found:<pane>`より**手前**に落ちる。2026-09-16はこれで枠が埋まり、編成をやり直した。
- selectedのままclaimしていない候補のpaneを閉じた場合も同じ理由で外せない（attachmentが無いのでdeparted扱いにならない）。paneを開き直してから外す。
- それでも外せず枠が埋まっている時: `disband --abandon <未終端assignmentを全件> --reason`でhandoffへ退避してから組み直す。回復手順は「disband handoffの回復」。
- departed laneを選択集合に残したままでも`close`は通る。`close`が拒否するのは**active**なnon-commander attachmentだけ。ただし枠を1つ食う。

### 凍結中の成果回収と連絡

**台帳が凍結してもgitは無傷である。** 各laneは自分のworktreeでcommitし、originへpushしないので、成果はlocal branchに残る。組み直しの前に必ず回収する。

```bash
git worktree list
git log --oneline origin/main..<lane branch>
git -C <lane worktree> status --short --branch
```

回収はcommanderのcherry-pick / mergeで行い、凍結中もlaneのbranchをpushさせない。

`report` / `note`が通らない間も、エージェント自身がagent-room CLIを通さず直接pane・native送信することは禁止する。禁止対象はエージェントのCLI外送信であり、CLI内部のtransport選択（native / legacy / degraded）ではない。CLIの旧経路選択を理由にエージェント自身の直接送信を認めない。成果と未報告事項を保全し、ownerへこの対話で凍結原因・影響・復旧条件を報告する。復旧後にCLI経由で台帳へ記録する。台帳IDの無い連絡への対応とreport不能時の境界は[messaging](messaging.md)のReceiver checksに従う。

## Owner questions

規則で一意に決まるworkspace mismatch、repository mismatch、窓数超過による除外、十分なhandoff後のrelease、既存assignmentの回収はownerへ尋ねない。次だけを影響laneをまとめた一通で尋ねる。

- 不足情報が結果を変える時のgoal、acceptance、lane数、alias、scope。
- 重複alias、候補が契約窓数を超える場合のselection。
- 追加paneの利用開始、laneLimit / ownership変更。
- dirty worktree、未共有commit、残作業の回収方法が一意でないleave / departure。
- commander_missingからの再開、不可逆判断、全lane停止。
- `EXTERNAL_REPO_REQUIRED`の別契約許可。

質問にはquestion、choices、推奨、affected lanes、waiting impact、可逆性を含める。
