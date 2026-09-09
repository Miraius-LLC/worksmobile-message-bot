---
name: tgl
description: Triangle-Gated Lead Loop workflow for agent-room. Use when planning or running multi-agent development where role/model routing selects Claude, Codex, agy, or Grok for design, implementation, verification, UI smoke, and final review, and the director distributes long multi-lane implementation across multiple lead agents instead of monopolizing implementation and creating review-wait queues. Each lane still has one lead agent, one worktree, and one vertical slice until commit-ready. Also use when checking TGL status, registering lanes, avoiding worktree conflicts, requesting final gate review, or preparing ship requests. This skill is standalone and does not depend on PLD.
---

# TGL

TGL means Triangle-Gated Lead Loop / 三角ゲート主任制. Use it as an agent-room-native coordination protocol, not as a PLD extension.

Prime directive: optimize for rework-resistant quality and team-built product quality, not raw speed or single-agent task completion. TGL exists to prevent late rework through independent implementation ownership, early design pressure, explicit path ownership, and final/integration review. Do not collapse lanes into a single-agent implementation merely because it seems faster or satisfying for the current agent to finish alone.

## Shape

TGL has three zones:

1. Design gate: role/model routing chooses independent reviewers for the plan, split, risks, and ownership.
2. Lead implementation: one lead agent owns one lane, one worktree, and one vertical slice until commit-ready. Long multi-lane sessions should distribute implementation lanes across available agents.
3. Final gate: the implementation owner plus two auto-routed independent reviewers triangulate the actual diff and bug risk before ship.

Use an integration gate when multiple lanes land or ship together.

## Start

Before starting or joining a TGL session:

```bash
agent-room tgl capabilities --repo <repo>
agent-room tgl status --repo <repo>
```

Confirm agent CLI capability, bridge pin state, active lanes, and conflict risk. If the TGL CLI is not implemented in the current environment, reproduce the same information manually with agent-room status, git status, and the session plan.

Before manually naming an agent, inspect the current route:

```bash
agent-room tgl route --role <role> --mode <read-only|work> --from <director>
agent-room tgl route --role reviewer --mode read-only --gate final --from <lead>
```

Use `--to auto` or omit `--to` for `tgl dispatch` and `tgl review` by default. Manual `--to` is an operator override for a concrete capability, bridge, load, path-owner, or domain reason; do not preserve an old fixed triangle out of habit.

Active AA model policyでは通常taskに`--tier economy|standard|critical`と`--optimize cost|speed|balanced`を指定でき、省略時は`economy + balanced`になる。通常routeはprimaryだけをdispatchし、secondaryはAA順位の次候補、`quota_fallback`はbinding-scope provider quota時だけ使う同authorityのchain先として別表示する。`dispatch --gate`は使わず、final / integrationの複数reviewは`tgl review`、候補確認だけなら`tgl route --gate`を使う。

Current cost/speed policy:

- `ui_smoke`: Grok 4.5 low with the fixed read-only Playwright preflight
- normal first review: Grok 4.5 high
- bounded rapid implementation: Grok 4.5 high via `rapid_coder`
- final / integration review: Claude/Codex are the deep-review core, with Grok as the fast supporting vote; exclude the requesting lead and select two
- short bounded verifier: agy on Gemini 3.6 Flash (Medium) (evidence-only when `--verification` is unspecified in `read-only` mode; passing a non-blank `--verification` in `read-only` mode is blocked prior to event/inject as read-only runs do not execute commands — use `--mode work` for command execution)
- **never route `verifier` to Grok when verification requires running commands.** Grok's read-only profile denies shell outright (`GROK_READ_ONLY_DENY_RULES`), so it cannot run `bun test`, re-run a suite, or perform a mutation falsification. It correctly refuses to mark criteria met and the lane stalls a full round-trip (tgl_3a7d32ace94f). "Short bounded verification" in this policy means bounded *judgement*, not command execution — for command-executing verification pick an agent whose profile allows shell.
- designer / security reviewer: Claude then Codex
- work coder: Codex / Claude / agy work models, excluding the director when possible
- rapid coder: Grok only for `mode=work`, `risk=bounded`, 1-8 explicit touching paths, and no sensitive/public-api/schema/migration/permission/deploy risk
- never auto-route agy Medium to broad final/integration review; its dogfood strength is short bounded work, not long repository-wide analysis

Then decide whether the work belongs on TGL and create the session with `tgl plan`:

```bash
agent-room tgl plan --repo <repo> --title <title> --director <agent> --objective <objective> \
  --touching <path> --touching <path> \
  --wip-limit 3 --pr-policy recommended --subagents limited
```

`tgl plan` creates the session and records a `tgl_plan` event. It judges split feasibility from `--touching`: two or more paths means `split feasible`; fewer means `split needs confirmation`, and it tells you to either add a real lane split or reject TGL for single-agent work. Add `--smoke ui` when the change needs UI smoke and `--risk sensitive` when it touches security-relevant surface; both set plan flags that later make `tgl gate` and the quality warnings demand a ui_smoke or security_reviewer role. Use `tgl start` only when you already know the split and do not need the plan judgment. Do not use plan to legitimize a single-agent lane monopoly.

From LINE WORKS, Fujii can ask without an agent mention:

```text
TGLの状況見せて
repo:agent-room TGL状況
```

The Worker replies with the compact TGL status directly and does not enqueue a Claude/Codex/agy run.

Create or identify:

- repo
- objective
- director agent
- base commit
- design gate reviewers
- lanes and lead agents
- canonical `touching` paths
- expected verification command

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

`--role` is director | designer | coder | rapid_coder | reviewer | verifier | ui_smoke | security_reviewer | release_coordinator | prevention_owner. `--mode work` hands a work-mode implementation lane; `--mode read-only` (default) is for review/verify/smoke. `rapid_coder` requires `--mode work --risk bounded` and 1-8 `--touching` paths; sensitive, public-api, schema, migration, permission, and deploy risks are rejected before injection. For UI smoke add `--smoke ui --phase prewarm|execute`; Grok ui_smoke also requires `--url <http(s)-url>`. The dispatch text carries role, mode, subagents, touching, verification, and constraints. `run_id` is already in the ledger: the stdout `run=` line of this dispatch, and for an existing lane `execution_run_links` (see [evidence](references/evidence.md)). Recover the reply with `agent-room run <run_id>`. Before the next action, write the `stage=dispatch` note from that `run=` line — ship is not required for this to fire. Dispatching real roles is what lets `tgl gate` and the quality warnings see that a lane has a verifier, a ui_smoke, or a security_reviewer instead of one agent doing everything.

If dispatch stops after recording only some stages, do not create a replacement lane or hand-run the missing side effect. Read the single `dispatch recovery:` command from `agent-room tgl status --repo <repo>` and execute it. `tgl dispatch --resume --session <session> --lane <lane> --assignment <assignment>` restores the original request, serializes concurrent retries, and skips completed event / assignment / inject stages before updating the lane. A normal dispatch with changed content gets a new request identity even on the same lane. Never combine `--resume` or an old explicit `--assignment` with changed content; that identity conflict is rejected before external delivery.

**A green suite is not evidence that a test constrains anything. Separate "a test exists" from "the test asserts the condition".** Before accepting a `met` claim, read the assertion and ask what input would make it fail. When the criterion is a bug fix or an invariant, **revert the fix and confirm the new test actually fails** — this is cheap (`git checkout <pre-fix-sha> -- <files>`, run the one test file, restore) and it is the only way to tell a real guard from a decorative one. One session shipped three false greens past a fully green suite: an ANSI-strip test asserting only `not.toContain(ESC)` while `31m` survived in the body, a test named "generates request and reply" whose fixture had no reply at all, and a cursor test that never placed two rows at the same timestamp. Each was found by an independent blind vote or by the director reproducing the condition, never by the suite. When the same director later reverted the fixes to check the replacement tests, they failed 2 and 6 assertions respectively — that check is what turned "tests were added" into evidence (TGL tgl_8ce6c6d8fd95).

**Number the acceptance criteria in the contract, and require the lead to check them off.** Write them as a numbered list, and ask the lead to return one line per number stating met or not met. A criterion that is written in the contract and repeated in the dispatch text still gets skipped otherwise: the parity test that pinned a pure function against its SQL projection was specified in both places, went unimplemented, and was only caught when both integration-gate reviewers independently flagged it as a blocker — one round trip later than necessary (TGL tgl_2e5db0dd6453).

**A met claim without evidence is not trustworthy.** For each acceptance number, require the test name that was run and its result (or an explicit "not run" / "unable to execute"). If the verification command cannot be executed in the environment, the lead must write "unable to execute" / 「実行不能」 instead of met — a bare met without that evidence should be rejected by the gate. The real accident was a headless met claim with no bun run at all (review_grok_e522491baa65); honest inability is more useful to the gate than an evidence-free green.

Route by evidence, not equal turns. Grok is the preferred fast lane for `ui_smoke`, cheap reconnaissance, first-pass review, and bounded `rapid_coder` work. A Grok `ui_smoke` dispatch sends a structured profile and URL; the poller performs a fixed open/1280x720 snapshot/console-error/requests/screenshot/close preflight, then Grok judges that evidence inside the same read-only shell-denied profile as normal review. Grok never receives browser Bash. Grok work uses a per-run home, strict custom sandbox, credential isolation, git shim, and mergeWorktree; common `.git` stays read-only to Grok, which edits/tests while the trusted poller stages and commits after validating the isolated run branch. Do not bypass the `rapid_coder` gate with manual `coder --to grok`. The rapid lane is single-shot and must not seed bot conversation; redispatch any follow-up so risk and touching are evaluated again. If the journey needs interaction or authentication, record the blocker and hand it to Claude/Codex/agy. Grok must never implement or solely approve security, permission, migration, deploy, schema, public API, or final architecture work.

When `model-policy status` reports an active AA fact, let `tgl route` / `dispatch --to auto` / `review --to auto` consume that tagged state. Set `--tier economy|standard|critical` and `--optimize cost|speed|balanced` from the task requirement, not from the agent/provider name; omitted values mean `economy + balanced`. Dispatch the primary only. Treat `secondary` as the next AA route candidate and `quota_fallback` as a separate same-authority chain target used only after a binding-scope provider quota observation; never dispatch either speculatively. Let fresh ledger availability exclude a binding, agent, or provider family; only the runner may use that quota chain once. Final/integration/sensitive/security review must keep the router's independent `critical+deep_review`, `standard`, and `economy+speed` seats; do not replace them with manual same-provider aliases. If active policy is invalid or lacks an independent panel, stop before injection. `ui_smoke` and Formation commander remain on their existing paths.

**Size a `rapid_coder` lane to the rapid budget before dispatching it.** The rapid lane is single-shot with a fixed turn/lease budget, and a lane that asks Grok to read a full design contract and satisfy a long acceptance list does not fit: a lane with a contract reference plus ≥9 numbered acceptance criteria failed twice in a row (`lease_expired`, then max turns — TGL tgl_2c8cac30eea1 / event_d3592d81394c), while a lane with 4 acceptance criteria, 3 touching paths, and the contract narrowed to only the relevant section completed cleanly (tgl_e5d3199489d8 lane2). Rule of thumb: **touching ≤4, acceptance criteria ≤5, and no full-contract reading** — quote the one contract section the lane needs in the dispatch text instead of pointing at the whole document. If the lane does not fit those bounds, split it or route it to a Claude/Codex `coder` lane instead of stretching the rapid gate.

`tgl dispatch --mode work` runs a review capacity check before injection: the dispatch must leave at least one independent deep reviewer (Claude/Codex not on a work lane) for the final gate. Session bridge pins do not consume deep slots: work runs and blind final/integration review runs bypass the bridge and execute headless (the bridge serves only ordinary read-only room replies). `review_capacity_risk=deep:0` blocks the dispatch; pass `--capacity-reason "<why>"` only for a recorded, deliberate override (the risk and reason are stored on the `tgl_dispatch` event). `fast:0` (no Grok support vote) is a warning, not a blocker. `tgl plan` prints the current `final gate capacity` line so the director can see deep/fast slots before assigning leads. For work lanes that must not land on main before the final gate (the normal form), add `--proposal patch|branch` to `tgl dispatch --mode work` — the run executes as a worktree proposal (no main merge/push, artifact returned) without falling back to `agent-room delegate`.

Fall back to raw `agent-room delegate` only when the TGL CLI is unavailable, or for design-gate discussion that has not been automated. Use read-only delegation for design/final gates, and work-mode implementation delegation for lanes owned by another agent. If the target agent can only run read-only in the current environment, either pick a different implementation lead or mark that reason explicitly.

Long context (design contracts, specs) does not travel through message bodies or attachments: inject bodies over ~4000 chars fail with 502 `send_failed`, and `delegate -F` attachments go to LINE WORKS only — they never land on the headless agent's filesystem. The standard is to commit the design contract into the repo (`docs/plans/...`), push it, and reference the repo path plus the `origin/main` commit in the dispatch/review text. Do not resend long bodies hoping they fit (observed: tgl_1326977e5643 design gate lost a round-trip to an unreadable attachment).

## Lead Lane Rules

As lead, own the slice until it is commit-ready. You may use your own subagents, background agents, reviews, and local loops internally. Agent-room should track only public lane state, not every internal subagent.

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

Templates, the two `run_id` retrievals, and the sqlite join: [evidence](references/evidence.md).

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

## Gates

Use `agent-room tgl review` for final / integration gate review when the CLI is available. It creates review assignments, injects read-only room runs, records assignment/run ids in the TGL ledger, and moves the lane to `reviewing` for final gate:

```bash
agent-room tgl review final \
  --session <session_id> \
  --lane <lane_id> \
  --repo <repo> \
  --from <lead_agent> \
  --to auto \
  --worktree <path-to-worktree> \
  --branch <branch> \
  --base-branch main \
  --base-commit <base_commit> \
  --diff <base_commit..head_commit> \
  --summary "final gate として bug risk / blocker / regression をレビューしてください"

agent-room tgl review integration \
  --session <session_id> \
  --repo <repo> \
  --from <director_agent> \
  --to auto \
  --worktree <repo-or-integration-worktree> \
  --branch <branch> \
  --base-branch main \
  --base-commit <base_commit> \
  --diff <base_commit..head_commit>
```

Use direct `agent-room delegate --blind` only as a fallback when the TGL review command is unavailable, or for design gate discussion that has not yet been automated.

`tgl review final|integration` creates genuinely blind runs: each reviewer receives the target diff and request but not Recent room context containing another vote. A normal-cost gate is self-review + Grok + one deep reviewer (Claude/Codex) = three independent perspectives. Auto routing stops before injection when no independent Claude/Codex reviewer is available; never count Grok alone as the final gate. Use manual `--to` only for a recorded capability, bridge, load, path-owner, or domain reason, and record it with `--route-reason "<reason>"` so the override lands in the dispatch event's `routingReason` metadata. Record latency, retry, collection friction, and finding adoption with assignment resolution plus `tgl note --type wait_time|retry|review_collection`; tune routing after several real runs instead of guessing from one benchmark. For non-friction coordination records (lane assignment summaries, hand-off notes), use `tgl note --type coordination` so `kaizen --from-session` does not pick them up as fake friction proposals.

**Deep reviewer starvation (`auto route blocked: 依頼元以外の Claude/Codex reviewer が 1 名以上必要`)**: when the director is the review requester and the only other deep agent (Claude/Codex) is a lane lead, auto routing always stops — the pool minus requester minus active lane leads is empty (TGL tgl_8ce6c6d8fd95). `tgl plan` and `tgl dispatch --mode work` warn about this configuration in advance ("この配分だと final/integration の auto routing が成立しません"). When it happens, route manually with `--to` + `--route-reason`, in this preference order:

1. **Wait until the lane lands** — a landed/terminal lane frees its lead for deep review (terminal lanes no longer count as work consumption).
2. **Use the lane lead as deep reviewer for a *different* lane or the integration diff** — acceptable when the diff under review is not the lead's own work product; the integration diff as a whole is a different observation target from the lane the lead wrote, but a review of the lead's own lane diff is self-review and does not count as an independent deep vote.
3. **Never** count Grok alone, or the requester's self-review, as the deep vote.

**Director in-session deep review (last resort when 1–2 are impossible)**: when the diff under review is the only other deep agent's *own lane* (option 2 is self-review) and the lane cannot land before the gate (option 1 is circular), the remaining independent deep perspective is the director themselves. Generic `delegate --to <self>` is available for a separate owner-seeded run, but TGL independence is stricter: `tgl review --to <self>` and reviewer-role self-dispatch are rejected by the TGL CLI. Run the deep review inside the director's interactive session instead: read the full lane diff against the contract's numbered acceptance criteria, verify the risky mechanics in source (not just the lead's self-report), and dispatch the fast vote (Grok) blind in parallel. The director did not implement the lane, so this is an independent perspective — but it is unledgered by default, so record it explicitly: put the director's verdict and findings into the ship request summary and the review `resolve` records, and satisfy verifier/release_coordinator roles with concrete evidence. Proven shape: TGL tgl_bc4d4887e489 (lead=codex, deep=director in-session + fast=grok blind; the two independently converged on the same pre-land finding).

For final gate, review the actual lane diff. Prefer `base_commit..head_commit`, not `origin/main..HEAD`, because main may have moved.

Director verification discipline — "a test exists" and "the test pins the property" are different claims, and gates must verify the latter (TGL tgl_8ce6c6d8fd95 hit three false-greens in one session: an ANSI-strip test that only asserted `not.toContain(ESC)` while `31m` leaked through; a test named "generates request and reply" whose assertion covered one case; a cursor test that never exercised duplicate `occurredAt` rows — all green, all caught only by blind votes or the director's own reproduction):

- **Reproduce the property the acceptance criterion asks about**, not a neighboring behavior. If the criterion says "OSC content is removed", feed an OSC sequence and assert the payload text is gone — not merely that ESC is gone.
- **Regression tests must be shown to fail on the pre-fix code.** Revert the fix (or weaken the guard) temporarily and confirm the new test goes red, then restore. If it stays green while the bug is back, the test pins nothing.

For multi-wave sessions, add one fixed gate question: **did a later wave silently disable an invariant that an earlier wave fixed with schema/tests?** Structural guarantees ("botId must match a registered bot") can be fail-opened by a 3-line change in a later wave (`allowedBotIds.length===0` → skip validation) while every test stays green. Features whose safety is "guaranteed by structure" deserve an architecture test asserting the invariant itself (e.g. "an empty allowlist means disabled, not skip-validation") so later waves cannot slip past a green suite (TGL tgl_956380ee6882).

If a blind final-gate review run was created but `agent-room reply <run_id>` or `agent-room run <run_id>` cannot read the result, do not close the lane or session as reviewed. Run:

```bash
agent-room run --debug <run_id>
```

Use the debug output to distinguish processing lease still active, reply not saved (`reply_body: missing`), reply saved but empty (`reply_body: empty` — a retried runner acked done with empty output; the room may have received the first attempt's reply, but the ledger has no body), failed run, send-stage issue, Worker read failure, or D1 fallback failure. Record the review as unrecovered until the reply body or an explicit failed/blocker state is visible.

Record review outcomes:

- accepted findings
- deferred findings
- rejected findings with reason
- remaining blocker
- verification evidence

Then record the resolution in the ledger. The review being resolved is identified by `--assignment` (the review assignment id printed at dispatch). `--target` is different: it is the reviewed lead assignment to close, used only together with `--close-target`:

```bash
agent-room tgl review resolve --session <session_id> --lane <lane_id> \
  --assignment <review_assignment_id> \
  --verdict accepted --adoption adjusted --summary "指摘はテスト追加として反映" \
  --requested-by <agent>

# close the reviewed lead assignment at the same time:
agent-room tgl review resolve --session <session_id> \
  --assignment <review_assignment_id> --close-target --target <lead_assignment_id> \
  --verdict accepted --adoption accepted --summary "採用済み" --requested-by <agent>
```

When `--adoption` is `accepted` or `adjusted`, run `tgl review prevention` in the same conversation. Do not wait for Finish or session close. That is the fire point that turns final-gate findings into prevention.

## Prevention after resolve (not only Finish)

Canonical fire: immediately after `tgl review resolve` with `adoption` `accepted|adjusted`. Close/Finish is only the leftover check for findings that still have no decision.

```bash
agent-room tgl review prevention --session <session_id>
agent-room tgl review prevention --session <session_id> --choice <n> --action adopt-backlog --todo TODO.md --yes
```

- Give each adopted finding a stable key: `file:line` or a skill section name. Do not leave free text as the only identifier.
- Decide `adopt-backlog` / `reject` / `defer` (one-off needs a reason on reject/defer).
- On the **next** `tgl dispatch` / `tgl plan`, put the prevention keys that apply to this touching set in `--summary`, or `prevention: none`.
- Put the same keys and where they landed (test / skill / TODO) in the next final-gate request. Reviewers may treat missing prevention as a blocker.

`prevention_owner` already exists as a role. An unclosed session needs one prevention pass after resolve, not a close.

`tgl-kaizen` is a close-time path. It is not a substitute for prevention.

**これは CLI で強制されない。破っても機械は止めない。** `tgl review resolve` may print the next prevention command; it does not run it. The next `tgl dispatch` does not require prevention keys. Director self-review is the only stop for a dispatch that has keys and omits them. A convention with no machine fire point does not fire. Candidate for later CLI enforcement: TODO.

## Ship

A lane becomes ship-ready only after:

- implementation is complete
- intended tests pass or failures are explicitly explained
- final gate findings are handled
- diff range and head commit are known
- ship request is visible

Use the advisory ship queue before any main push/deploy race:

```bash
agent-room tgl ship request \
  --session <session_id> \
  --lane <lane_id> \
  --summary "final gate passed; ready to land" \
  --head <head_commit> \
  --verification "bun test" \
  --requested-by <agent>

agent-room tgl ship list --repo <repo>
agent-room tgl status --repo <repo>
```

`ship request` does not push, deploy, merge, or tag. It records a `ship` event, moves the lane to `ship_ready`, moves the session to `shipping`, and makes the FIFO queue visible to the director/human. Treat it as coordination, not approval. After a request that includes `--verification`, write the `stage=ship` note (`result=pass|fail|unable`). This stage is optional in the sense that ship may never happen; dispatch/working notes must still exist. **verification 無しを skill 上 ship-ready とみなさないこと、および stage=ship note は CLI で強制されない。破っても機械は止めない。**

When a worktree proposal branch produced `refs/notes/agent-room/proposals/<run_id>`, inspect and clean proposal refs through TGL:

```bash
agent-room tgl proposal list
agent-room tgl proposal adopt --session <session_id> --lane <lane_id> --repo <repo> --branch refs/notes/agent-room/proposals/<run_id> --target <adopt_branch> --summary "adopt proposal for final gate"
agent-room tgl proposal gc --older-than 7d
```

`proposal gc` is dry-run by default. Add `--yes` only when the listed refs are safe to delete.

Do not race another lane to main. Use the TGL ship queue or manual coordinator. Main push, deploy, and tag operations must follow repo policy and approval boundaries.

After push, make sure CI/deploy watch is connected or explicitly delegated.

### Base advanced after final review

If final / integration review already passed but `origin/main` (or the base branch) moved before ship or land, **do not ship on the old base**. Anyone (director, lead, release_coordinator, Fujii) follows the same manual recovery runbook:

- SoT: `docs/runbook/tgl-closeout-recovery.md`
- Flow: `git fetch` → classify base/head delta → recover commits into a fresh integration worktree based on the new base → re-verify → ship / re-review / blocked → record evidence

Minimum evidence to leave in a `tgl note` or room reply: `reviewed_base`, `origin_base_now`, `new_head`, classification, verification commands + result, and the ship verdict. Record recovery completion reports with `tgl note --type recovery_report` (not `friction_note`), so `kaizen --from-session` does not resurface the finished recovery as a fake friction proposal. Update lane `--head` after recovery. If conflict cannot be resolved, re-verify fails, or the new base changes contracts / behavior enough to invalidate the prior gate, treat it as a Finish blocker and re-run final/integration review on the new diff instead of shipping.

## Close

TGL is not closed just because code was written. Close only after:

- all lanes are landed, deferred, rejected, or blocked
- final or integration gate is resolved
- adopted final / integration review findings have a prevention decision (canonical fire is review resolve, not this close check)
- ship status is clear
- CI/deploy outcome is known or watch is assigned
- `shimekukuri` has checked the TGL Finish closeout
- `tgl-kaizen` has captured repo / agent-room / deploy-flow improvement ideas

## Finish With Shimekukuri

Use the existing Develop-wide `shimekukuri` skill during TGL Finish. Do not create or distribute an agent-room-owned skill with the same name; `shimekukuri` is a Develop/global closeout skill, while TGL is the agent-room-native caller.

Invoke it after final gate or integration gate, before kaizen:

```bash
agent-room tgl status --repo <repo>
agent-room status --health
git worktree list
git fetch origin
git rev-parse origin/main
```

During Finish, if any ship-ready or just-reviewed lane still sits on a base older than `origin/main`, run the closeout recovery before kaizen or session close: `docs/runbook/tgl-closeout-recovery.md` (fetch → delta class → re-verify → ship judgment → evidence). Do not close the session as cleanly shipped while that recovery is unfinished.

If the closeout exposes friction that should feed kaizen, record it immediately:

```bash
agent-room tgl note --session <session_id> --lane <lane_id> --summary "摩擦: run retrieval required manual review file recovery" --requested-by <agent>
```

Use a concrete observation: failed command, manual recovery, retry loop, confusing help, deploy/watch wait, or an agent coordination conflict.

Pass this TGL-specific context into `shimekukuri`:

- repo and session id
- lane ids, lead agents, statuses, touching paths, and next actions
- base/head commits and diff ranges
- observed worktree heads and whether each ready lane is fresh or drifted
- final/integration review run ids and whether replies were recovered
- adopted, deferred, rejected, and blocker findings
- ship request / main push / deploy watch status
- leftover worktrees or branches that must be preserved

Prevention's canonical fire is immediately after `tgl review resolve` (`accepted` / `adjusted`), not this Finish step. Before kaizen and session close, only confirm leftover adopted findings still have no decision:

```bash
agent-room tgl review prevention --session <session_id>
agent-room tgl review prevention --session <session_id> --choice <n> --action adopt-backlog --todo TODO.md --yes
```

- For each leftover adopted finding, decide one-off vs recurrence prevention (test / help / skill / runbook / script / TODO / CLI).
- Track later with `tgl review prevention --choice ... --action adopt-backlog --todo TODO.md --yes` so the TODO one-liner (`- [ ] 再発防止: <summary> (TGL <session_id> / <review_id>)`) and the `review_prevention` event are written together.
- One-off: `--action reject` or `--action defer` with a reason already on the resolve record or a TGL note.

Treat these as Finish blockers unless explicitly delegated:

- lane still `ready`, `reviewing`, or `ship_ready` with no ship/non-ship decision
- final/integration review run exists but the reply body or explicit failed/blocker state is not visible
- final gate passed but `origin/main` advanced and closeout recovery (re-verify / ship judgment / evidence) is not done
- stale lane with no owner-visible next action
- adopted review finding has no prevention decision and no explicit one-off reason
- merged worktree still present
- CI/deploy outcome unknown and no named watcher
- `tgl-kaizen` not invoked

## Invoke Kaizen

Always invoke `tgl-kaizen` during TGL close. Treat it as a standalone skill that TGL calls, not as a private appendix.

Pass this context when available:

- repo
- session id and lane ids
- director and lead agents
- base/head commits and diff ranges
- final/integration gate findings
- adopted, deferred, and rejected review points
- ship request status
- CI/deploy/watch result
- coordination friction observed in agent-room

`tgl-kaizen` should return ranked improvements and where to persist them. Apply accepted changes to TODO, plans, runbooks, scripts, tests, or skills according to the user's instruction.

Persist the result through the TGL ledger so the session can prove kaizen happened:

```bash
agent-room tgl kaizen --session <session_id> --from-current
agent-room tgl kaizen --session <session_id> --repo <repo> --from-session
agent-room tgl kaizen --session <session_id> --from-current --choice <n> --action adopt-backlog --todo TODO.md --yes
agent-room tgl events --session <session_id> --kind kaizen --details
```

Use `--from-current` when a proposal JSON exists. Use `--from-session --repo <repo>` when TGL Finish has no `.agent-room/kaizen/current.json`; it builds proposals from session/lane/ship/event history and prioritizes `tgl note` friction notes over generic review/ship evidence. If the proposal was recorded but not visible in the closeout flow, use `events --kind kaizen --details` to re-display the saved proposal UI from the TGL ledger. Use `tgl review prevention` at review resolve as the prevention fire point; at close it is only the leftover check. Kaizen does not replace prevention. Use the choice command after Fujii chooses, or when an accepted default is explicit, to record the selected action and optional TODO adoption.

Use `agent-room-ops` for command selection and `tgl-kaizen` for the final improvement pass.
