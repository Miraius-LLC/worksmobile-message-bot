---
name: tgl-kaizen
description: Use after TGL or standalone closeout, an incident or bug hunt, deploy or CI failure, or an agent workflow to capture observed improvements.
---

# TGL Kaizen

Capture practical improvements while evidence from the work is fresh. This works with or without a TGL session.

## Scope

- Use friction observed in the current closeout, review, incident, deploy, CI, or agent workflow.
- Do not scan the repository for theoretical improvements or turn kaizen into a general code review.
- Proposals may reach beyond the implementation when the current work exposed the need; label inference and preserve its evidence.

## Choose a mode

### TGL close

- Was design and lane ownership clear before parallel work?
- Did review find something a closer test or earlier gate could have caught?
- Did ship, pre-push, CI, deploy, or watch introduce avoidable waiting?
- Did the director have enough status to answer who owned each lane?

### Standalone closeout

- What repo command, fixture, seed data, test, or document slowed down the work?
- Where did agents have to rediscover conventions or document locations?

### Incident or bug hunt

- Which invariant or signal was missing or late?
- Which log, status, artifact, or watcher would have surfaced it sooner?
- What check or recovery step belongs closest to the cause?

### Agent workflow

- Were ownership, routes, reviewer context, and results traceable?
- Which handoff, bridge, or coordination step stalled or needed manual recovery?

## Rank and report

Rank a short list by data-loss or unsafe push, deploy, or notification risk; repeated waiting or races; status visibility; cross-repo consistency; and recurring manual work. Default to 3–5 proposals. Each one includes:

- recommendation and evidence from this work;
- scope (inside the change or an observed follow-up), type, and destination;
- the next small action and whether it is `adopt-now`, `adopt-backlog`, `defer`, `reject`, or `split`.

If the evidence is inferred or weak, label it and prefer a backlog item or deferment. Do not leave Fujii a long unranked list.

## Persist and implement

- Put backlog in `TODO.md`, plans in `docs/plans/`, architecture decisions in `docs/adr/`, operational procedures in `docs/runbook/`, and deterministic prevention in tests, scripts, or skills. Follow [documentation placement](https://github.com/fujimogn/agent-room/blob/main/docs/agents/documentation.md).
- A proposal is not authority for broad implementation. Implement code or repo-wide changes only when explicitly selected or requested.
- In TGL close, this skill is invoked through [TGL ship-and-close](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/ship-and-close.md#invoke-kaizen). Use `agent-room tgl kaizen --help` for current options and choose the session/current evidence source supported by the CLI.
- Without a TGL session, persist through the matching repository source such as TODO, a plan, ADR, runbook, skill, script, or test.
- Review-finding prevention is recorded at review resolution, separately from close-time kaizen; see [TGL gates](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/gates.md#prevention-after-resolve-not-only-finish).
