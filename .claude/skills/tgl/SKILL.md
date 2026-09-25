---
name: tgl
description: Use to start or route TGL multi-agent work, manage TGL lanes and reviews, or close and ship a TGL session.
---

# TGL

TGL runs a gated development loop with one lead, lane, worktree, and vertical slice. Use it for one repository; use Formation to coordinate the parent member lanes.

## Rules shared across workflows

- Use automatic role routing by default. Record a reason when capability, load, bridge, path ownership, or domain needs a manual route.
- Plan before splitting work. Give each lane a bounded, non-overlapping slice, explicit touching paths, acceptance evidence, and a dedicated worktree.
- Formation remains the parent authority: use Formation CLI for commander-member coordination; TGL work inherits the active assignment's scope, allowed methods, and concurrency.
- A `working` lane or dispatch receipt is not execution evidence. Check the worktree head, acceptance tests, review result, and saved run evidence.
- Keep final and integration review independent; a fast review alone cannot satisfy the deep-review gate. Resolve findings and apply prevention at the documented gate.
- A ship request only records readiness in the TGL queue. Recheck and recover when the base advances; do not treat the request as push, merge, or deploy.
- Close only after lanes are terminal, review and prevention decisions are recorded, ship status is clear, CI/deploy is known or watched, and kaizen is captured.

## Read the matching procedure

- Session start, roles, model policy, and routing: [start-and-routing](references/start-and-routing.md).
- Lane design, dispatch, resume, and observation: [lanes](references/lanes.md).
- Run and stage evidence: [evidence](references/evidence.md).
- Final/integration review and prevention: [gates](references/gates.md).
- Shipping, base recovery, closeout, and kaizen: [ship-and-close](references/ship-and-close.md).

Use `agent-room tgl --help` for command syntax. Room, Council, UI, and managed skill operations route to [agent-room-ops](https://github.com/fujimogn/agent-room/blob/main/skills/agent-room-ops/SKILL.md).
