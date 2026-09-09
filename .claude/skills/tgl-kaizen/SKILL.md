---
name: tgl-kaizen
description: Standalone kaizen retrospective for extracting durable improvements from any development closeout, TGL slice/session, review, bug hunt, deploy, CI failure, pre-push friction, or multi-agent workflow. Use to identify improvements for the repo, agent-room, skills, tests, scripts, runbooks, deploy flow, CI/watch, agent coordination, and future lead/subagent loops. TGL should invoke this skill during its close step, but this skill must also work independently when no TGL session exists.
---

# TGL Kaizen

Use this after implementation, review, debugging, deploy, or closeout while the friction is still fresh. The goal is to turn "next time this should be faster" into tracked repo improvements.

This skill is standalone. If a TGL session exists, use its lane/session context. If no TGL session exists, run the same retrospective against the current repo, worktree, PR, commit range, review result, or user-described workflow.

Use the word `kaizen` as the stable skill and command name. Do not translate it to a different feature name unless the user asks.

## Purpose

The main purpose is to let AI notice and propose improvements autonomously, based on the same themes Fujii usually points out manually.

Do not wait for Fujii to say "改善して". During closeout, look back over the session and identify small improvements that would have made this exact work smoother. Fujii can then choose which proposals to adopt.

Treat Fujii's recurring themes as standing intent:

- make repos behave more consistently
- make commands, docs locations, naming, and closeout easier to predict
- reduce manual coordination between agents
- reduce duplicated deploy, push, pre-push, and CI/watch work
- convert repeated friction into scripts, tests, skills, runbooks, TODOs, or shared conventions

## Boundary

This is not a refactoring hunt, architecture audit, or large-scale code review. Do not scan the whole repository looking for theoretical improvements.

Focus only on friction observed in the current session:

- What would have made this exact session faster, safer, easier to coordinate, or easier to explain?
- What did the agent or Fujii actually have to wait for, rediscover, manually coordinate, or recover from?
- What missing command, doc, convention, status, test, or skill would have helped during this session?

Avoid broad proposals like "refactor module X" unless the need appeared directly in the session and the proposed next step is small.

Do not restrict kaizen to the exact implementation scope. The implementation task may be narrow, but the improvement proposal may go beyond it when the session revealed a nearby workflow, tooling, documentation, naming, status, or coordination problem. The boundary is the observed session friction, not the files changed in the implementation.

Good scope expansion:

- implementation touched one script, but the session revealed a missing shared command convention
- final review needed repeated manual diff commands, so propose CLI support or a request template
- deploy was not part of the feature, but closeout exposed duplicated deploy/watch work
- a repo-specific docs location slowed the agent down, so propose a standard location or alias
- a narrow bug fix showed a missing smoke test or pre-push check

Valid kaizen outcomes include backlog proposals. The output does not need to be immediately implemented. It may be:

- a design improvement to add to TODO
- a script or CLI command that would reduce repeated manual work
- a shared helper, convention, or template that would make future repos easier
- a docs/runbook/skill update that would make agents faster next time
- a test, lint, smoke, or pre-push check that would catch this session's problem earlier

If the user asks for broad refactoring or large-scale review, use a different skill or workflow. `kaizen` may record a follow-up idea, but it should not become the review itself.

## Inputs

Gather only what is available:

- TGL session and lane status, if present
- current repo, branch, worktree, commit range, or PR
- design review / final review / bug hunt findings
- adopted / deferred review comments
- tests and CI/deploy outcome
- git/pre-push/merge/deploy friction
- LINE WORKS / agent-room / bridge / poller / delegation friction
- missing scripts, docs, runbooks, or skills
- places where subagents or bridge workflows helped or stalled
- user comments like "this was slow", "this coordination was annoying", or "this should be automatic"
- repo conventions that differ from Fujii's usual workflow, especially command names, document locations, file/directory naming, closeout steps, or where agents should look first

## Modes

Choose the lightest mode that fits.

### TGL close mode

Use when closing a TGL lane or session. Check:

- Was design gate early enough?
- Did the lead lane expose `touching`, `next`, and status clearly?
- Did another lead risk changing the same files?
- Did final gate find issues that a test, type, lint, schema check, or prompt guard could have caught?
- For each adopted final / integration review finding, is there a prevention target (test, help, skill, runbook, script, TODO, or CLI) or a clear one-off reason?
- Did ship request, pre-push, CI, deploy, or watch create waiting time?
- Did the director have enough information to answer "who is doing what?" in LINE WORKS?

### Standalone closeout mode

Use when ordinary development finishes without TGL. Check:

- What did this repo make harder than it needed to be?
- What command, script, fixture, seed data, or test should exist before the next similar task?
- What documentation or runbook would prevent rediscovery?
- Are docs, plans, ADRs, reviews, runbooks, TODOs, and skills located where agents expect them?
- Are file names, directory names, command names, and script names consistent with Fujii's other repos?
- What agent-room command or skill would have reduced coordination overhead?
- What deploy or CI signal should have appeared earlier?

### Incident or bug-hunt mode

Use after debugging, failed CI, failed deploy, pre-push failure, race, or regression. Check:

- What invariant was missing?
- What signal arrived too late or in the wrong place?
- What automated check would have failed closest to the cause?
- What log, status, artifact, or watcher should have existed?
- What manual recovery step should become a runbook or command?

### Agent workflow mode

Use after multi-agent work even if no code changed. Check:

- Did agents know who owned which slice?
- Did `delegate`, `respond`, `watch`, `reply`, or `run` create enough traceability?
- Did bridge pinning help or confuse the route?
- Did a reviewer need context that should have been in the request template?
- Should `agent-room-ops`, `tgl`, or another skill gain a rule?

## Review Questions

Ask these concretely:

- What repeated manual step should become a command, script, test, or runbook?
- What would Fujii likely have asked to improve if he had watched this whole session?
- What did the lead agent need to know but had to rediscover?
- What repo behavior, command, document location, or naming rule differs from other repos and should be standardized?
- What should become a shared convention across `~/Develop` repos rather than a local habit in this repo?
- What conflict or race risk did agent-room fail to show early?
- What CI, pre-push, deploy, or watch step delayed closeout?
- What review finding appeared because a contract or invariant was not encoded?
- What skill instruction would have prevented confusion?
- What should be added to `agent-room-ops`, `tgl`, `shimekukuri`, or a repo-local skill?
- What belongs in agent-room itself rather than in a per-agent prompt?
- What would make the next deploy, push, review, or handoff shorter?
- What should be measured or shown in status so Fujii can ask LINE WORKS and get a useful answer?

## Expand The Ideas

Do not stop at the exact frustration reported by the user. Expand adjacent improvements when they are credible and actionable.

Examples:

- If pre-push was slow or flaky, consider smaller targeted checks, better failure summaries, cached artifacts, or status integration.
- If deploy was duplicated, consider ship queue, deploy lock, CI watch correlation, and room-visible ownership.
- If review found the same issue repeatedly, consider a test helper, lint rule, prompt contract, fixture, or checklist.
- If agent coordination was unclear, consider lane status, `touching` conflict detection, default request templates, or `agent-room-ops` updates.
- If a skill was missing context, consider whether the source of truth should live in `skills/`, `AGENTS.md`, `docs/runbook/`, or repo code.
- If a repo uses a different docs layout, command shape, or naming convention, consider a compatibility alias, migration plan, or shared convention update instead of leaving it as local knowledge.

Keep expanded ideas honest and session-bound: label uncertain ideas as candidates, and do not invent facts about commands, CI, deploys, or repo structure that were not observed in this session.

It is acceptable, and often desirable, to propose improvements outside the original implementation slice. State the connection to the session explicitly:

```text
範囲外だが今回見えた改善: ...
今回の根拠: ...
次の小さい一手: ...
```

## Standardization Lens

Always include a short pass for cross-repo consistency. Fujii prefers repositories to feel similar where possible, so future agents can move between repos without rediscovering basics.

Check only areas touched or exposed by the current session:

- Commands: `test`, `typecheck`, `lint`, `dev`, `build`, `doctor`, `deploy`, `smoke`, `db:migrate`, and repo-specific wrappers.
- Closeout: validation, commit, push, remote equality, CI/deploy watch, worktree cleanup, and handoff.
- Docs layout: `README.md`, `AGENTS.md`, `TODO.md`, `CHANGELOG.md`, `CONTEXT.md`, `docs/README.md`, `docs/agents/`, `docs/plans/`, `docs/adr/`, `docs/reviews/`, `docs/runbook/`, `skills/`.
- Naming: kebab-case source files, predictable script names, no date prefixes unless repo convention requires them, clear artifact names.
- Agent entrypoints: where Claude/Codex/agy should read first, where repo-specific skills live, and which skill owns local workflow.
- Environment: `.env.tpl`, `doctor` checks, setup/bootstrap scripts, and missing dependency diagnostics.
- Status visibility: whether LINE WORKS / agent-room / CLI can answer "what is running, what is blocked, what should ship next?"

Output standardization items separately when useful:

```text
標準化候補: ...
対象 repo: ...
揃えたい基準: ...
移行方法: alias / docs update / script rename / new shared rule / no-op
```

Avoid forcing uniformity when the repo has a real domain-specific reason to differ. In that case, document the reason and where future agents should find it. Do not perform a repo-wide standardization audit unless explicitly asked.

## Prioritize

Rank by practical leverage:

1. Prevents data loss, force-push risk, broken deploy, or wrong-user notification.
2. Prevents repeated human waiting or agent race.
3. Makes status visible to LINE WORKS / CLI.
4. Standardizes repo behavior, docs location, or naming across `~/Develop` repos.
5. Converts repeated review findings into tests or rules.
6. Saves small but frequent manual steps.

## Output

Produce a short ranked list. Default to 3 to 5 proposals. If there are more candidates, group or defer them; do not make Fujii choose from a long unranked list.

```text
1. 改善案: ...
   今回の根拠: ...
   範囲: 実装内 / 範囲外だが今回見えた改善
   種別: TODO化 / スクリプト化 / 共通化 / docs-runbook / skill更新 / test化
   置き場所: TODO.md / docs/plans/... / docs/runbook/... / skills/... / script / test / agent-room CLI
   推奨: adopt-now / adopt-backlog / defer / reject / split
   次の小さい一手: ...
```

Every proposal must include `今回の根拠`. If the evidence is weak, mark it as `inferred` and prefer `adopt-backlog` or `defer`.

When the user asks to implement the improvements, update the appropriate repo source of truth. When the user asks only for a proposal, do not edit files.

## Selectable Proposal UI

When proposing kaizen items to Fujii, make the choice easy. Prefer a recommended default plus selectable alternatives.

Text proposal shape:

```text
推奨: 1 を採用
理由: 効果が大きく、実装が小さく、次回からすぐ効くため。

1. 採用: ...
2. 保留: ...
3. 捨てる: ...
```

Future CLI shape:

```bash
agent-room kaizen propose --repo <repo> --from-current
agent-room kaizen select <proposal_id>
```

The CLI should show a select UI when interactive use is available. For headless use, print numbered options and a recommended choice.

Choice types:

- `adopt-now`: create or update TODO / plan / skill immediately.
- `adopt-backlog`: record as backlog only, especially for design improvements, script ideas, or shared-convention candidates.
- `defer`: keep as a note for later reconsideration.
- `reject`: do not persist, with a short reason.
- `split`: turn one broad idea into smaller proposals.

Always mark one recommendation unless all options are genuinely unsafe or under-specified. If uncertain, recommend `adopt-backlog` rather than doing nothing.

## Auto-Implementation Boundary

Do not automatically implement broad kaizen proposals. By default, kaizen proposes, ranks, and persists small accepted records.

Allowed without a separate implementation request:

- add a TODO item
- add a short plan note
- update this skill or another agent-room-owned skill when the user is already asking to refine the skill
- record a TGL kaizen event when CLI support exists

Require explicit user selection or instruction before:

- repo-wide standardization
- script or CLI implementation
- broad docs migration
- test suite restructuring
- behavior changes outside the current requested work

## Placement

Classify where the improvement belongs:

- `agent-room core`: queue, runner, bridge, TGL, CI/watch, ship coordination.
- `agent-room-owned skill`: `agent-room-ops`, `tgl`, `tgl-kaizen`, or related agent-room-native skills.
- `Develop-wide skill`: `shimekukuri` and other closeout / workflow skills whose SoT lives outside agent-room.
- `repo-local script`: commands or scripts useful only in the current repo.
- `repo-local docs`: README, TODO, plans, ADR, reviews, runbook, context.
- `cross-repo convention`: shared `~/Develop` rule, naming, docs layout, closeout pattern, or setup expectation.

If placement is uncertain, recommend `adopt-backlog` with a note about where to decide.

## Examples

Example 1:

```text
1. 改善案: ship 待ち lane を status に出す
   今回の根拠: pre-push / main 取り込みの順番が会話上で曖昧になった
   範囲: 範囲外だが今回見えた改善
   種別: agent-room CLI
   置き場所: docs/plans/... / TODO.md
   推奨: adopt-backlog
   次の小さい一手: tgl ship status の最小設計を TODO に積む
```

Example 2:

```text
1. 改善案: docs 配置の標準確認を closeout に入れる
   今回の根拠: 計画・TODO・skill の置き場所を会話中に確認した
   範囲: 範囲外だが今回見えた改善
   種別: skill更新
   置き場所: skills/tgl-kaizen/SKILL.md
   推奨: adopt-now
   次の小さい一手: Standardization Lens に docs layout 確認を追加する
```

## Persist

Save TGL close results as TGL kaizen events:

```bash
agent-room tgl kaizen --session <session_id> --from-current
agent-room tgl kaizen --session <session_id> --repo <repo> --from-session
agent-room tgl kaizen --session <session_id> --from-current --choice <n> --action adopt-backlog --todo TODO.md --yes
agent-room tgl review prevention --session <session_id> --choice <n> --action adopt-backlog --todo TODO.md --yes
agent-room tgl events --session <session_id> --kind kaizen --details
```

Use `--from-current` when this skill has written `.agent-room/kaizen/current.json`. Use `--from-session --repo <repo>` when the TGL session already contains enough evidence in lane/ship/event history; `agent-room tgl note` friction notes are preferred evidence. `--from-session` ranks friction notes (`manual_recovery` / `review_collection` / `wait_time` / `retry` / `friction_note`) above review / ship / deploy proposals — explicitly typed non-friction notes (`recovery_report` / `shimekukuri` / `coordination`) are excluded even when their text contains friction vocabulary — and each friction proposal carries the source note's event id plus a recovery-target candidate (CLI help / fallback / skill step / TODO) so the operator can decide where to route the friction in one step. When a friction proposal is chosen, `tgl kaizen --choice <n>` persists the source event id, note type, and recovery target as friction recovery metadata on the `kind=kaizen` event, so a later reader can trace which friction was recovered where. If a proposal event was recorded but the operator did not see the full proposal UI, use `events --kind kaizen --details` to re-display the saved proposal list. The choice command records the selected proposal/action and, when requested, persists an accepted backlog item to TODO. Choice recording is idempotent: the event id is derived deterministically from session×proposal×action, so re-running the same choice detects the existing event and no-ops (no duplicate kaizen event, no duplicate TODO line).
Use `tgl review prevention` when the improvement source is specifically an adopted final / integration review finding. It lists accepted / adjusted `review_resolution` events and records the selected prevention follow-up as a TGL kaizen event.

If the improvement is accepted, update the repo source of truth:

- `TODO.md` for backlog
- `docs/plans/` for implementation plans
- `docs/adr/` for durable architectural decisions
- `skills/<name>/SKILL.md` for agent-room-owned skill improvements
- repo scripts/tests for deterministic prevention
- help text, runbooks, or agent-room CLI when an adopted review finding should be detected before final review next time

If no TGL session exists, persist through the normal repo channels: TODO, plan, ADR, runbook, skill update, or issue tracker.

## TGL Integration Contract

The `tgl` skill should call this skill during close. TGL provides:

- session/lane id if available
- repo and base/head commits
- final/integration gate result
- ship request and CI/deploy status
- unresolved blockers and deferred findings

This skill returns:

- ranked improvements
- suggested persistence location
- whether each item is immediate, backlog, or rejected
- skill updates that should be applied to `agent-room-ops`, `tgl`, `tgl-kaizen`, the Develop-wide `shimekukuri`, or repo-local skills
