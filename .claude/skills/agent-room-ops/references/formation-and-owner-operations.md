# Formationとowner向け操作

このreferenceは操作の分岐と前提を説明する。実際の必須flagは各commandの `--help` を読み、ID・path・revisionは実測する。runtimeのlive CLIとsource checkoutの版は別。

## Formation assignの前提

1. commanderとmemberがclaim済みで、active attachmentがある。実行paneがcommander自身であり、Herdrの現在のpane・native session・repo fingerprintが台帳のattachmentと一致する。paneが見えるだけでは足りない。
2. `formation status --id <id> --json` でrevisionとmember実行枠を確認する。assignはidleまたはsafe_checkpointだけ許可される。executing / review_returned / wip_fullへ無理に割り当てない。
3. unique command-id / assignment-id、to-lane、改行のないsummary、herdr-session、expected-revision、child-concurrency、1つ以上のtouchingとacceptanceを指定する。touchingはrepo相対の明示pathで、末尾スラッシュ・絶対path・空segment・dot segmentは禁止。summaryはtrim後1〜4000字。
4. child-concurrencyはFormation上限以内。allowed-methodは権限の許可であり、能力の所持証明ではない。fresh観測で利用不能と判定されたmethodを許可しようとするとassignは拒否される。effort上限はfresh観測で超過が確定すれば拒否、取得不能は警告になる。Shipperの検証済み能力必須条件とは別。

拒否は `formation_assign_…:<原因>` のsuffixを読み、commander_not_admitted、commander_route_mismatch、lane_not_attached、target_invalid、method_unavailable、effort_over_capを切り分ける。scopeやidentityを推測で補って再送しない。revision_conflictは最新statusで再確認する。

## report・ACK・次のassignment

memberはassigned scopeを保持し、STARTED / RED / BLOCKED / CANDIDATE_READYを `formation report`。commanderへの通常room投稿で代替しない。report直前にrevisionを再取得する。CANDIDATE_READYには固定commit、verification、evidence、独立reviewを付ける。

通常運用はcommanderが成果を確認して `formation ack --assignment-id <id>` を行い、次のassignを配る。ACKはcommanderのみで、active laneかつ最新reportがCANDIDATE_READYのreport_required assignmentに限る。STARTEDやBLOCKEDはACKできない。

実装上はCANDIDATE_READY後のACK待ちが1件だけならsafe_checkpointとして次のassignを許可する。これは実行枠と責任を別管理するためで、前assignmentの責任・証跡・ACKは残る。先行割当を「自動ACK」や「前仕事の消失」と説明しない。review返却後のRED / BLOCKEDはreview_returnedとなり、再STARTEDまで新規割当を止める。

## cancelとrelease

- `formation cancel --assignment-id <id> --reason <text>`: commanderが未終端assignmentを取り消す。STARTED / BLOCKED / CANDIDATE_READYを問わず対象にできるが、releasedは対象外。lane attachmentは保持されるので、scopeを修正して新しいassignment-idで再assignできる。
- `formation release --lane <id>`: commanderがactive laneを回収する。未終端assignmentがあるなら、その全IDだけを `--recovered-assignment` に列挙する。各assignmentがreport_required、最新CANDIDATE_READY、subordinateActivity=none、verificationとevidenceRefsが非空であることが必要。
- ACK / cancelで既にreleasedとなったassignmentをrecovered集合へ入れない。未終端がなければflagを省略する。集合の不足・余分や回収条件不足はlane_has_unrecovered_assignment。
- member laneのreleaseはattachmentを解放する。commander自身の場合は回収可能なassignmentが必要で、assignmentだけを解放しcommander attachmentは残す。単にBLOCKEDを消す目的ならcancelと区別する。

## ShipperとTGL ship

Formation Shipper適格はfreshに検証された `modern_cli` のみ。shellが使える、同じagent名である、allowed-methodに記載した、といった情報だけでは適格にならない。取得不能や期限切れを所持証明にしない。

`tgl ship request` はadvisory FIFO queueの記録でpush / merge / deployを実行しない。Formationの `formation ship` と相互代用しない。deployやlive変更の承認はどちらのqueueからも推論しない。

## Council

- `council prepare`: 人間の対話端末で手順書§0〜§2を行う。source checkout / fetch後origin/main SHA / 1Password item候補を表示し、stdinのyesで進む（--yesはない）。clean / HEAD一致 / 必要commitを検証し、gate OFFを確認、env退避、secret作成・注入、権限と一致を検査する。secret値は出力しない。progressを使い再開し、gateをONにしない。
- `council set-gates <true|false>`: prepare完了時のsource rootでCOUNCIL_ENABLED / DISCORD_COUNCIL_ENABLEDのみatomic更新しprogressへ記録する。同じstepの反復はexit 1、逆遷移は可能。prepare記録欠落・複数・未完了なら停止する。runtime deployは別操作。
- `council canary --ballot <id>`: awaiting_ownerを確認し、missing / bad-signature / non-ownerの負例3件を送る。各403 + reason一致 + state不変が必要。成功時だけDiscordの正例 `!council decide <id> A` を表示する。**正例投稿・owner裁定は人間が行う。** 失敗時は正例を出さずexit 1。

いずれも必要時にhelpとrepoの `docs/plans/2026-09-08-council-rollout-gate-off-delivery-procedure.md` を読む。secret / gate変更 / live canary / deployを読み取り専用操作と誤認しない。

## 管理UI

`agent-room ui` は127.0.0.1専用read-only server。token付きURL、Origin検証、SameSite=Strict cookie。port既定0は空きportを選ぶ。他hostへのbind、書込みAPI、provider照会はない。queueはlocal app、usageは既存collector snapshotを使い、unavailableを0へ置換しない。終了はCtrl+C。旧consoleではなくuiを使う。

## skills status / install

- sourceはrepoの `skills/`。statusはmanaged sourceとdestのok / missing / drift比較で、書込みなし。
- installも既定dry-run。`--yes` でmissing配置、drift上書き、managed-manifest.json更新。`--dry-run` が同時にあればこちらが優先。missing / driftが残るdry-runはexit 1。
- manifest外destは触らず、未知fieldのmanifestやdest外nameはfail-closed。
- `--target codex,claude,agy,grok` と `--all` は排他。`--skill` で限定し、`--source` でsource directoryを指定できる。CodexとGrokは同じ `.agents/skills` root、Claudeは独立copy。
- repo内の `skills/` と `.claude/skills/` の同期は配布先へのlive installと別。文書変更の検証だけで実環境へのinstallを実行しない。

根拠: repoの `src/cli/commands/formation.ts`、`packages/domain/src/formation.ts`、`src/cli/commands/council.ts`、各live CLI help（2026-09-16照合）。新しい挙動はhelp / source / runtime版を再確認する。
