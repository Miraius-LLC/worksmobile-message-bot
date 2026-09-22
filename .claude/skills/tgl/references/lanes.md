# TGLの実装分担・lane・UI smoke

## Implementation Distribution

TGL is not "one agent implements everything, others only review" when the work is long or naturally split into multiple lanes. The director must decide and record implementation ownership before work starts. The decision should favor fewer surprises and less rework over shortest wall-clock time.

The director is not a primary implementer by default. The director's job is to raise quality by splitting lanes, assigning capable leads, keeping path ownership clear, forcing early risk discovery, and preventing review bottlenecks. A director who privately implements most lanes and then asks other agents to review has created a serial review queue, not parallel implementation.

If the work cannot be split into meaningful, independently owned lanes, reject TGL for that work instead of pretending it is a TGL session. State the reason and ask Fujii to confirm a single-agent implementation path:

```text
TGL としては却下します。
理由: <why lane split would be artificial or harmful>
提案: 単独実装として <agent> が進め、必要なら最後に review だけ依頼します。
この単独実装で進めてよいですか？
```

Do not use TGL language to legitimize a single-agent lane monopoly. Either split real implementation ownership, or explicitly step out of TGL and get confirmation for single-agent implementation.

Default policy:

- 1 lane: one lead agent is fine; use other agents for design/final review.
- 2 lanes: prefer 2 different lead agents unless one lane is tiny or blocked by missing capability.
- 3+ lanes or long-running work: assign implementation lanes across Claude / Codex / agy where capability allows. Do not keep all implementation in Codex just because Codex is the current interactive agent.
- Cross-cutting integration can have a director/integration lane, but it should not absorb independent feature lanes that another agent can implement.

Lane scoping rules (from Team Banter waves, TGL tgl_956380ee6882):

- Cut lanes at the smallest unit whose **observable behavior changes on its own**. A lane that implements an engine but leaves the production wiring out of scope lands as inert output: config becomes dead fields and hooks never fire. If the lane alone does not change behavior, include the wiring in its scope. This is a director-level split decision, not an implementer omission.
- When a lane adds a Worker route, include the production entry (`src/worker/index.ts`) deps construction **and a test that the route works with production-equivalent deps** in the same lane. Route/type additions can be green on tsc and unit tests while the deployed Worker 503s on every call because `getState()` never injects the store.
- When designing a new store/port, confirm **which execution environment the consumer calls it from** before fixing the interface. A store designed for direct D1 access is unreachable from the poller, which only reaches D1 through Worker HTTP; that mismatch surfaces at wiring time, waves later. Write "who calls this layer from where" into the design contract.
- When a design contract depends on an existing mechanism, **cite it as `file:line` in the contract before the design gate**. If you cannot cite it, the mechanism does not exist yet and must be inside the lane's scope or split into its own slice. Reviewers answer the design question you ask; they do not verify that your premises are real. A contract that assumed poller-observed verification commands sent two leads into lanes with no foundation to build on, and both failed to start (TGL tgl_c15b713db8d7).
- **The citation requirement covers naming and path conventions, not just mechanisms.** A contract that describes where something lives ("`.agent-room-worktrees/` + run id") is asserting a convention, and an unverified convention fails exactly like an unverified mechanism. A director wrote that path from memory without reading `worktree-ops.ts`; the real convention passes the id through `sanitizeWorktreeName` (`:` becomes `_`) and appends `-attempt-N` on retry, so the shipped resolver could not find any worktree from a real run id — and neither design-gate reviewer caught it, because they verified the design against the stated convention rather than against the code. Cite the function that produces the name, not the shape you remember (TGL tgl_8ce6c6d8fd95).
- **When gate decisions are written back into a contract, re-read every requirement and acceptance criterion against them and delete or rewrite any clause the decisions contradict.** A stale criterion is not dead text — it is a literal instruction the lead will implement and reviewers will verify against. A contract whose binding section said "conversation_key stays unchanged" while its acceptance criterion still said "computeConversationKey must not take transport" (pre-decision ADR wording) got the transport removed from the legacy key, with pinned test expectations rewritten to match; two blind final-gate reviewers approved it because they checked the same stale criterion, and only the director's diff inspection caught it (TGL tgl_4c68695bfe2c).
- **Label every code fragment in a design contract as either a conceptual sketch or a fixed specification.** A snippet simplified to explain intent reads as the confirmed implementation form once it sits in the contract, and the lead implements it literally. Mark a sketch with "concept — the lead decides the implementation form", and leave a fragment unlabelled only when the lead must implement it as written. A `COUNT(*) ... < N` SQL skeleton written as illustration was independently corrected by both design-gate reviewers as needing a unique deep-consumer set; taken literally it would have mis-rejected an agent's second dispatch and mis-accepted a lane-only lead (TGL tgl_2e5db0dd6453).
- **Never put the enforcement of an invariant behind an optional argument or flag.** If a caller can omit it, the invariant is silently disabled and every test stays green. Make omission fail-closed, or make the parameter impossible to omit in the type. This is the same failure as a lane that ships an engine without its production wiring, and it has now appeared three times: an unwired Worker route (tgl_956380ee6882), a CLI flag missing from the spec table so the boolean was unusable (tgl_c15b713db8d7), and a capacity CAS that fell back to the unchecked path when its `reviewCapacity` option was absent (tgl_2e5db0dd6453).

- **When lanes are split at a contract boundary, put the boundary test in BOTH lanes' acceptance criteria — never in the contract prose alone.** A boundary test that belongs to "the integration" belongs to nobody, and each lane closes green against its own mock. A contract said "結合で必ず 1 本置く: A の POST → B の Query" in its lane-split section but numbered it under neither lane; lane A sent `occurredAt` as an ISO string, lane B's schema required epoch ms, **every POST would have 400'd**, and both lanes reported all criteria met with full green suites. The director found it only by hand-parsing lane A's payload with lane B's schema during integration (tgl_3a7d32ace94f). Write the boundary test as a numbered criterion in each lane, and require the shared types to be cut first by one named lane.

Dedicated role policy:

- director: plans, assigns, tracks fan-in, and decides gates
- designer: fixes interface / data / permission / deploy contracts before coding
- coder: implements the claimed lane and provides test evidence
- rapid_coder: implements a bounded, explicitly-scoped small lane quickly; never handles sensitive/API/schema/migration/permission/deploy changes
- reviewer: returns a verdict and separates blocker / non-blocker / suggestion
- verifier: owns test matrix, reproduction, smoke, and evidence
- ui_smoke: owns UI journey / viewport / console / network / screenshot evidence
- security_reviewer: owns secrets / dependency / auth / permission / deploy-risk checks
- release_coordinator: owns branch protection, PR checks, merge queue, deployment environment, and CI/deploy watch
- prevention_owner: turns accepted findings, retries, and incidents into tests / docs / skills / TODO

Do not assign these roles by agent identity permanently. Assign them per work item. Claude / Codex / agy / Grok can each serve different roles depending on capability and availability.

Treat these role combinations as quality warnings unless Fujii explicitly accepts the risk:

- director also owns the main coding lane
- coder also acts as final reviewer
- coder also acts as release coordinator for org repo / deploy / production-impacting work
- UI implementer also performs the only UI smoke
- no security reviewer exists for auth / permission / secrets / dependency / deploy-flow changes
- no verifier exists for a non-doc code change
- no release coordinator exists for PR / deploy / merge queue work

For org repos and high-risk changes, treat the final gate as required evidence, not a courtesy review. Before ship or ff push, verify at least approvals count, verifier green, security green where applicable, UI smoke status where applicable, and release coordinator status. If any required evidence is missing, block ship and return the next action.

Director anti-patterns:

- implementing multiple independent lanes yourself and leaving other agents as reviewers only
- creating a pile of finished local work that waits on sequential final reviews
- treating review as the only form of collaboration
- optimizing for "I completed the task" instead of "the team reduced rework risk"
- delaying delegation until after the architecture, contracts, or path ownership are already fixed by one agent

If any of these happen, stop and redistribute before continuing unless Fujii explicitly chose a one-agent implementation.

Before implementing, publish a lane assignment summary:

```text
repo:<repo>

TGL 実装分担:
- director: <agent>
- lane A: <lead_agent> / touching: <paths> / next: <first step>
- lane B: <lead_agent> / touching: <paths> / next: <first step>
- review-only agents: <reason if any>
```

If all implementation lanes stay with the current agent, record the reason in the session or room before coding. Valid reasons include missing CLI capability, bridge read-only state, unavailable credentials, path conflicts, a truly tiny follow-up, or Fujii explicitly asked for one-agent implementation. "Faster if I just do it" is not enough for long multi-lane work; it usually increases hidden coupling and late rework risk.

Review-wait rule: A lane is not "parallelized" just because other agents will review it later. Parallel implementation means other agents own implementation work while the director and other leads continue useful work. If the plan creates a state where the current agent is done implementing and the main remaining activity is waiting for others to review, treat that as a TGL design failure and record a redistribution or integration plan.

For multi-wave TGL, create an integration worktree early when lane outputs start depending on each other. Do not let later lanes inherit stale parent commits after amend/rework. Stabilize final candidates in one integration worktree before final/integration review and before adding them to the ship queue.

When another agent should implement a lane, use `tgl dispatch` rather than only asking for review. It is the TGL-native wrapper over raw delegation: one command runs assignment create, room inject, lane update, and a `tgl_dispatch` event, so the ledger records who owns the lane and in which role:

```bash
agent-room tgl dispatch \
  --session <session_id> --lane <lane_id> --repo <repo> \
  --from <director_agent> --to <lead_agent> \
  --role coder --mode work --subagents limited \
  --touching <path> --touching <path> \
  --summary "<objective + contracts + verification>"
```

`--role` is director | designer | coder | rapid_coder | reviewer | verifier | ui_smoke | security_reviewer | release_coordinator | prevention_owner. `--mode work` hands a work-mode implementation lane; `--mode read-only` (default) is for review/verify/smoke. `rapid_coder` requires `--mode work --risk bounded` and 1-8 `--touching` paths; sensitive, public-api, schema, migration, permission, and deploy risks are rejected before injection. For UI smoke add `--smoke ui --phase prewarm|execute`; Grok ui_smoke also requires `--url <http(s)-url>`. The dispatch text carries role, mode, subagents, touching, verification, and constraints. `run_id` is already in the ledger: the stdout `run=` line of this dispatch, and for an existing lane `execution_run_links` (see [evidence](evidence.md)). Recover the reply with `agent-room run <run_id>`. Before the next action, write the `stage=dispatch` note from that `run=` line — ship is not required for this to fire. Dispatching real roles is what lets `tgl gate` and the quality warnings see that a lane has a verifier, a ui_smoke, or a security_reviewer instead of one agent doing everything.

If dispatch stops after recording only some stages, do not create a replacement lane or hand-run the missing side effect. Read the single `dispatch recovery:` command from `agent-room tgl status --repo <repo>` and execute it. `tgl dispatch --resume --session <session> --lane <lane> --assignment <assignment>` restores the original request, serializes concurrent retries, and skips completed event / assignment / inject stages before updating the lane. A normal dispatch with changed content gets a new request identity even on the same lane. Never combine `--resume` or an old explicit `--assignment` with changed content; that identity conflict is rejected before external delivery.

**A green suite is not evidence that a test constrains anything. Separate "a test exists" from "the test asserts the condition".** Before accepting a `met` claim, read the assertion and ask what input would make it fail. When the criterion is a bug fix or an invariant, **revert the fix and confirm the new test actually fails** — this is cheap (`git checkout <pre-fix-sha> -- <files>`, run the one test file, restore) and it is the only way to tell a real guard from a decorative one. One session shipped three false greens past a fully green suite: an ANSI-strip test asserting only `not.toContain(ESC)` while `31m` survived in the body, a test named "generates request and reply" whose fixture had no reply at all, and a cursor test that never placed two rows at the same timestamp. Each was found by an independent blind vote or by the director reproducing the condition, never by the suite. When the same director later reverted the fixes to check the replacement tests, they failed 2 and 6 assertions respectively — that check is what turned "tests were added" into evidence (TGL tgl_8ce6c6d8fd95).

**Number the acceptance criteria in the contract, and require the lead to check them off.** Write them as a numbered list, and ask the lead to return one line per number stating met or not met. A criterion that is written in the contract and repeated in the dispatch text still gets skipped otherwise: the parity test that pinned a pure function against its SQL projection was specified in both places, went unimplemented, and was only caught when both integration-gate reviewers independently flagged it as a blocker — one round trip later than necessary (TGL tgl_2e5db0dd6453).

**A met claim without evidence is not trustworthy.** For each acceptance number, require the test name that was run and its result (or an explicit "not run" / "unable to execute"). If the verification command cannot be executed in the environment, the lead must write "unable to execute" / 「実行不能」 instead of met — a bare met without that evidence should be rejected by the gate. The real accident was a headless met claim with no bun run at all (review_grok_e522491baa65); honest inability is more useful to the gate than an evidence-free green.

Route by evidence, not equal turns. Grok is the preferred fast lane for `ui_smoke`, cheap reconnaissance, first-pass review, and bounded `rapid_coder` work. A Grok `ui_smoke` dispatch sends a structured profile and URL; the poller performs a fixed open/1280x720 snapshot/console-error/requests/screenshot/close preflight, then Grok judges that evidence inside the same read-only shell-denied profile as normal review. Grok never receives browser Bash. Grok work uses a per-run home, strict custom sandbox, credential isolation, git shim, and mergeWorktree; common `.git` stays read-only to Grok, which edits/tests while the trusted poller stages and commits after validating the isolated run branch. Do not bypass the `rapid_coder` gate with manual `coder --to grok`. The rapid lane is single-shot and must not seed bot conversation; redispatch any follow-up so risk and touching are evaluated again. If the journey needs interaction or authentication, record the blocker and hand it to Claude/Codex/agy. Grok must never implement or solely approve security, permission, migration, deploy, schema, public API, or final architecture work.

When `model-policy status` reports an active AA fact, let `tgl route` / `dispatch --to auto` / `review --to auto` consume that tagged state. Set `--tier economy|standard|critical` and `--optimize cost|speed|balanced` from the task requirement, not from the agent/provider name; omitted values mean `economy + balanced`. Dispatch the primary only. Treat `secondary` as the next AA route candidate and `quota_fallback` as a separate same-authority chain target used only after a binding-scope provider quota observation; never dispatch either speculatively. Let fresh ledger availability exclude a binding, agent, or provider family; only the runner may use that quota chain once. Final/integration/sensitive/security review must keep the router's independent `critical+deep_review`, `standard`, and `economy+speed` seats; do not replace them with manual same-provider aliases. If active policy is invalid or lacks an independent panel, stop before injection. `ui_smoke` and Formation commander remain on their existing paths.

**Size a `rapid_coder` lane to the rapid budget before dispatching it.** The rapid lane is single-shot with a fixed turn/lease budget, and a lane that asks Grok to read a full design contract and satisfy a long acceptance list does not fit: a lane with a contract reference plus ≥9 numbered acceptance criteria failed twice in a row (`lease_expired`, then max turns — TGL tgl_2c8cac30eea1 / event_d3592d81394c), while a lane with 4 acceptance criteria, 3 touching paths, and the contract narrowed to only the relevant section completed cleanly (tgl_e5d3199489d8 lane2). Rule of thumb: **touching ≤4, acceptance criteria ≤5, and no full-contract reading** — quote the one contract section the lane needs in the dispatch text instead of pointing at the whole document. If the lane does not fit those bounds, split it or route it to a Claude/Codex `coder` lane instead of stretching the rapid gate.

`tgl dispatch --mode work` runs a review capacity check before injection: the dispatch must leave at least one independent deep reviewer (Claude/Codex not on a work lane) for the final gate. Session bridge pins do not consume deep slots: work runs and blind final/integration review runs bypass the bridge and execute headless (the bridge serves only ordinary read-only room replies). `review_capacity_risk=deep:0` blocks the dispatch; pass `--capacity-reason "<why>"` only for a recorded, deliberate override (the risk and reason are stored on the `tgl_dispatch` event). `fast:0` (no Grok support vote) is a warning, not a blocker. `tgl plan` prints the current `final gate capacity` line so the director can see deep/fast slots before assigning leads. For work lanes that must not land on main before the final gate (the normal form), add `--proposal patch|branch` to `tgl dispatch --mode work` — the run executes as a worktree proposal (no main merge/push, artifact returned) without falling back to `agent-room delegate`.

Fall back to raw `agent-room delegate` only when the TGL CLI is unavailable, or for design-gate discussion that has not been automated. Use read-only delegation for design/final gates, and work-mode implementation delegation for lanes owned by another agent. If the target agent can only run read-only in the current environment, either pick a different implementation lead or mark that reason explicitly.

長いdesign contract / specは短い依頼文から固定版を参照する。過去には約4000字超のinjectが502 `send_failed`、LINE WORKS経由の `delegate -F` がheadless filesystemへ届かず、design gateをやり直した（tgl_1326977e5643）。現行transportの添付可否をこの旧事例から断定しない。Formation内のreviewではrepoの `skills/formation/references/review.md` に従い、実在する絶対path + sha256 + base/headを渡し、添付・成果本文inlineを使わない。契約をcommitして固定し、pushはrepo / lane契約で許可された場合だけ行う。Formationでpush禁止ならローカル固定版を使う。

## Lead Lane Rules

As lead, own the slice until it is commit-ready. 通常TGLではsubagents / background agents / review / local loopsをlane内部で使える。Formation配下ではassignmentのallowed methods、child concurrency、子作業の追跡契約を優先し、無許可の子作業を起動しない。

Before editing, state the absolute worktree path and run edits from that worktree. Treat an ambiguous cwd as a blocker. `apply_patch` and formatting commands must target the lane worktree, not main or another lane.

Keep public state current:

```bash
agent-room tgl lane update <lane_id> \
  --status working \
  --touching src/example.ts \
  --next "store tests"
```

Before marking a lane ready or requesting final gate review, observe the real worktree HEAD:

```bash
agent-room tgl lane observe <lane_id> --worktree <path-to-worktree>
agent-room tgl lane update <lane_id> --status ready --head <head_commit>
agent-room tgl status --repo <repo>
```

Use the full 40-character commit SHA for lane `--head`. Short SHAs are only for display; storing short SHAs makes real drift and display-only drift indistinguishable.

Formation laneをTGLへ接続する場合は、lane作成時に`--formation <formation_id> --lane <formation_lane_id>`を指定する。CLIは作成前にFormation statusをowner read-onlyで検査し、active laneとTGL sessionのrepo一致を満たさない入力を拒否する。接続後はFormation lane IDをTGL lane IDへ共有するため、execution linkとreply presentationのlane labelが同じidentityになる。

Treat `head=<sha> / obs=<sha> / fresh` as the normal ready state. If status shows `drift`, update the lane head or re-check the worktree before asking another agent to review. Do not present the ledger as current when `lane observe` cannot read the worktree.

Treat `no_progress=<age>` on a working lane and the session-level `stall candidate:` lines as a director signal, not an automatic stop. Lanes record `first_edit_at` on the first edit evidence (a clean-to-dirty worktree transition or a head advance seen by `lane observe` / `lane update --head`; re-observing an already-dirty worktree does not count) and `last_progress_at` on edit evidence or a forward status transition; a working lane with no progress for 30+ minutes is listed as a stall candidate (`(no_edit)` means no edit evidence has ever been seen). **Dispatched is not executing.** `working` means a dispatch landed; execution evidence is `first_edit_at` or a terminal `queue_runs` status via the linked `run_id`. A working lane with `first_edit_at` null and a failed linked run is an unexecuted dispatch, not an in-progress agent. Respond by splitting the lane, re-dispatching (`tgl dispatch --to auto`), blocking the lane, or recording why the lane is legitimately long-running — do not kill the lane just because the flag appeared, and do not leave a failed linked run as working.

Treat `quality warning:` in `tgl status` as a director-level blocker until explained or fixed. `single_lead`, `director_implements`, and `review_wait_risk` mean the session is drifting toward serial single-agent implementation. Once `plan` / `dispatch` role metadata exists, the same warning line also flags role conflicts and coverage gaps: `director_is_coder`, `coder_is_reviewer`, `coder_is_release_coordinator`, `missing_verifier`, `ui_without_smoke`, `missing_security_for_sensitive_change`, and `missing_release_coordinator`. These fire even for a single active lane, so a one-lane session that has one agent coding, self-reviewing, and shipping will still surface the conflict. Redistribute lanes, dispatch the missing role, record why it is impossible, or explicitly mark Fujii's one-agent decision before continuing.

Use `tgl gate --session <session_id>` for a read-only role/evidence summary before final gate or ship. It lists dispatched roles, quality warnings, per-role claim state (`missing | claimed | active | satisfied | blocked`) with holder and evidence, review dispatch/resolution counts, pending ship count, and the `missing evidence` set. Treat any `missing evidence` other than `none` as something to dispatch or explain, not to skip.

Role coverage and evidence are separate ledgers. `tgl role claim --role <role> --agent <agent> --summary ... --requested-by <agent>` declares an owner and clears `missing_*` warnings, but it is not evidence: ship stays blocked until `tgl role satisfy --role <role> --agent <agent> --evidence "..." --claim-event <event_id> --requested-by <agent>` records the verification result with reference integrity (the satisfy agent must match the referenced claim/dispatch holder). Claimable roles are reviewer / verifier / ui_smoke / security_reviewer / release_coordinator / prevention_owner only. Self-claim of reviewer / security_reviewer / ui_smoke is rejected; verifier / release_coordinator / prevention_owner self-claim is director-only. A new dispatch of the same role after satisfy invalidates the evidence (rework demote), and a `--head` mismatch against the lane head marks it stale — re-verify and satisfy again. The Worker blocks `ship request` with 409 `role_evidence_missing` when required roles (verifier with active lanes, plus plan-flagged ui_smoke / security_reviewer) lack fresh evidence; `--single-agent-reason` overrides distribution/dual-duty warnings only, never evidence.

When CLI support is missing, post a compact status update to the room with repo, lane, status, touching, next, and blocker.

Do not silently expand scope. If touching paths or contracts drift, record drift and ask the director whether a re-design gate is needed.

## Lane evidence (dispatch / working / ship)

Evidence is per stage. A later stage that never arrives does not erase the duty of the earlier one. Dispatch evidence fires even when ship never happens.

1. **dispatch** (required as soon as `tgl dispatch` prints `run=`): write one `tgl note --type coordination` with `stage=dispatch` and that `run_id` before any other work. For a lane whose stdout is gone, take `run_id` from `execution_run_links` and write the same note. If the linked run is `failed`, do not leave the lane working.
2. **working** (when `no_progress` / `(no_edit)` appears, before the next dispatch): one `stage=working` note. `first_edit_at` null means the dispatch has not executed.
3. **ship** (only if ship happens): `tgl ship request --verification` then one `stage=ship` note with `result=pass|fail|unable`. A ship request without verification is not ship-ready on this skill. Count a session as「証跡なし」when dispatch/working notes are missing, even if ship is zero.

Templates, the two `run_id` retrievals, and the sqlite join: [evidence](evidence.md).

**これは CLI で強制されない。破っても機械は止めない。** `tgl dispatch` already stores the run and prints `run=`; it does not require the stage note. Finish-only evidence never fires on a stalled working lane.

## UI Smoke Squad

When a TGL session includes UI changes, create a dedicated smoke investigation lane separate from implementation. A lead's self-check is necessary but not sufficient for ship readiness.

Start the UI smoke squad while implementation is still in progress. Its first job is prewarm: start or identify the dev/preview environment, confirm auth state and smoke user, prepare target URLs, choose desktop/mobile viewports, and attach Playwright/Chrome tooling. The goal is to be `ready_to_smoke` before the implementation lane reports ready, so smoke can start with minimal wait.

Treat UI smoke as a verify lane, not a review-only comment:

- assign it to an agent or subagent that did not implement the UI lane when possible
- prewarm the dev / preview environment before the implementation lane finishes
- use `playwright-cli`, Chrome/browser tooling, or the repo's existing smoke command
- check at least desktop and mobile viewports when the UI is responsive
- capture URL, viewport, auth state, screenshot/snapshot path, console errors, failed requests, and the tested journey
- record prewarm status as warming / ready_to_smoke / smoking / blocked
- classify findings as blocker / non-blocker / visual-risk
- compare against `DESIGN.md`, existing component conventions, and the domain tone when those exist

Do not let the smoke squad silently fix UI. If it finds issues, return evidence and classification to the director. The implementation lead or director decides whether to patch, defer, or reject the finding.

Record the smoke result as a TGL note or assignment artifact. Prefer the dedicated `ui_smoke` role:

```bash
agent-room tgl dispatch \
  --session <session_id> \
  --lane <lane_id> \
  --to auto \
  --role ui_smoke \
  --mode read-only \
  --smoke ui \
  --phase prewarm \
  --summary "UI smoke prewarm: dev/preview env, auth, target URLs, viewports, and browser tooling"
```

When the implementation lane reports ready, ask the same smoke squad to execute the prepared journey and return evidence. If the CLI does not support that wrapper yet, use `agent-room delegate --mode read-only` and then record a `tgl note` with the same evidence. UI smoke blockers should be treated as ship blockers for UI lanes unless Fujii explicitly accepts the visual risk.
