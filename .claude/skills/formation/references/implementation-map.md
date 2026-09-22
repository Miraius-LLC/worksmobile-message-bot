# Formation implementation map

意味契約はSKILL.mdと[contract](contract.md)。本ファイルは実装seamのfile:line、live境界、判断記録だけを置く。行番号は`origin/main`の観測値であり、実装変更でずれうる。

## Capacity and commander mode

- WIP上限（実行中1件 + ACK待ち1件）: `projectMemberCapacity` / `MemberExecutionFrame`（`packages/domain/src/formation.ts:987`、`:983-1014`）。超過する`assign`は`lane_has_active_assignment`（同file `:1079-1084`）。
- ACK待ちだけで実行枠が空いているmemberへの次work候補: `proposeNextWorkCandidates`。候補でありassignment確定ではない。
- Commander participation mode: `FORMATION_COMMANDER_PARTICIPATION_MODES`（`packages/contracts/src/formation.ts:19-22`）。CLI受理はハイフンの`director-only` / `director-and-implementer`だけ（`src/cli/commands/formation.ts:180-186`）。helpの誤表記はCLI側の別修正。欠落・空文字は`director-only`（domain `:47-51`、schema `.catch('director-only')` は contracts `:24-26`）。不正値は`formation_start_input_invalid:commander-mode`（CLI `:2602`）。`director-only`への実装assignは`commander_implementation_forbidden`（domain `:1046-1053`）。`status --json`のfieldは`commanderParticipationMode`。

## Pane model and method

- Picker候補行とassignment直前のfresh **model** snapshot（BindingCapability / AA tier）、`status --json`の`capabilities[]`（OpenSpec 2.2 / 2.3）。
- pane **method**（`subagents` / `tgl` / `modern_cli` 等）は BindingCapability と別語彙（`packages/contracts/src/formation-pane-methods.ts:7-12`）。
- 唯一のHerdr metadata書き手は`publishPaneMethodReport`（`apps/herdr-plugin/src/formation/method-reporter.ts:59-62`、token `ar_cap_methodsVer` / `ar_cap_methodsRef`）。
- 検証は`resolvePaneMethods`（`packages/contracts/src/formation-pane-methods.ts:117`）、shipへ載せるのは`projectValidatedPaneMethods`（同file `:228-245`。不正・staleなら空配列）。
- model snapshotが`unknown`のときの一次記録: Claudeは`~/.claude/projects/<project>/<session>.jsonl`の`message.model`、Codexは`~/.codex/sessions/<date>/rollout-*-<session>.jsonl`の最新`turn_context`の`payload.model`と`payload.effort`（`session_meta`やconfig既定は権威にしない。実装は`src/formation/pane-capability-source.ts`）、Antigravityは`~/.gemini/antigravity-cli/log/cli-*.log`のmodel endpoint。読めない時だけ`unknown`。
- `assign --allowed-method`は許可であって保有要求ではない。確認済み`unavailable`だけmutation前に拒否し、`unknown` / `not_observed`は通す（`src/cli/commands/formation.ts:1850-1878`）。
- 初期probeはCodexのexact native turnだけで`modern_cli`を観測し、他agentはunknown。手順は`docs/runbook/formation-method-probe.md`。
- consumer / reporter は runtime `3329faa4` に live 入り（Formation契約 18:3x）。

## Shipping

- 軽量Shipper routing: `routeLightweightShipper`（`packages/domain/src/formation-shipping-routing.ts:121-146`）。適格条件は検証済み`modern_cli`のみ（同file `:48` `:110-114`。AA tierは問わない。2026-09-16 藤井決定、案 C）。
- Domain gate: `decideFormationShipOperation`（`packages/domain/src/formation.ts:2305-2357`）。
- `ff_merge` Application seam: `executeFormationFfMerge`（routing → fresh observation → Domain gate → CAS、`packages/application/src/formation-shipping.ts:103-168`）。
- OS Git adapter: target refへ`update-ref` CAS（old-value照合）。checkout中targetはCAS後に`reset --hard`（`src/formation/adapters/git-ff-merge.ts:56` `:209-325`、CAS本体 `:270-322`）。`ls-remote` 15秒timeout（`DEFAULT_LS_REMOTE_TIMEOUT_MS = 15_000`）。
- envelope store: `saveFormationShipEnvelope` / `loadFormationShipEnvelope`（`packages/application/src/formation-ship-envelope-store.ts:55-66` `:72-89`）。file adapterは`src/formation/adapters/ship-envelope-file-store.ts:21-77`。
- CLI: `ship-release`（`src/cli/commands/formation.ts:984-1040`）と`ship`（同file `:838-938`）。`ff_merge`以外は`ship_operation_not_allowed`（`:1034-1039`、test `:5488`）。既定CLIはtrusted runtime未接続を`ship_runtime_not_configured`で拒否する（`:861` `:931` `:1137`）。`--ship-runtime trusted-local`はcanary専用opt-in（`src/cli/spec.ts:567-570`、ship-release `:1136-1157`、ship `:845`）。
- 操作手順: `docs/runbook/formation-shipping.md`。
- OpenSpec scenario「live接続と文書契約が未完了である」: `openspec/changes/define-formation-member-first-flow/specs/formation-member-first-flow/spec.md:183-186`。canary合格後も本番deployはHuman Gate。

## Close, reseat, disband

- close前に全memberを`formation release`。commander以外のactive attachmentが残ると`formation_close_incomplete` / `active_lanes`（`packages/domain/src/formation.ts:1405-1414`）。
- `--excluded-candidate`はstart時の`excludedCandidateIds`から`reseat --add`済みを除いた集合と一致（同file `:1440-1444`）。CLIは`flagValues('excluded-candidate')`（`src/cli/index.ts:706`、spec `:693`）。
- reseat `--add`の物理identity照合は**いま選択中の候補**と **`status=active` attachment** だけ（`departed` と既に外した候補は照合しない）。reseat canaryはrelease → remove → add → challenge → claimまで合格（判断記録 16:4x）。
- disband canaryは合格（`3329faa4` 編成記録）。

## Remaining work（現行CLIが自動強制すると推測しない）

- agy / Grokのsourceとlive pane model切替の実機conformance（OpenSpec 2.1）。
- 適格Shipper paneの用意（検証済み`modern_cli`。Commander自身のship経路は無い。観測済み: grokは`modern_cli` unknown。codexのtier=nullは適格判定を止めない）。
- live本番出荷はHuman Gate（判断記録 17:3x）。Shipper canaryは2026-09-16合格。

## History

- 判断記録 16:4x: reseat canary（release → remove → add → challenge → claim）。
- 判断記録 17:3x: 今夜の本番出荷見送り。canary後もHuman Gate。
- 判断記録 18:3x: pane method consumer / reporter が runtime `3329faa4` に live 入り。
- 2026-09-16 藤井決定 案 C: Shipper適格はagent名ではなく検証済み`modern_cli`のみ。AA tierは問わない。
- 2026-09-11 藤井決定: 48h中断のhandoffは新規機構を作らず既存`~/Develop/.agent-room/<project>/handoffs/`を使う。
