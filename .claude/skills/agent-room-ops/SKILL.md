---
name: agent-room-ops
description: Use for agent-room delegation or room replies; run and queue recovery; Formation, Council, or UI operations; or managed skill distribution.
---

# Agent Room Ops

Run commands from the target repository. Write repository-specific requests in Japanese and start with `repo:<allowlist-name>`; never use a branch or worktree name as the repository.

Use `agent-room delegate` for other agents. Launching an agent directly requires Fujii's explicit direction. Read the selected command's `--help` before operating.

## Core rules

- For commander-member operations, follow the [Formation skill](https://github.com/fujimogn/agent-room/blob/main/skills/formation/SKILL.md).
- `accepted` and delivery confirmation are separate. Follow the command's recovery contract; a Formation report marked `unconfirmed` is saved and must not be rerun.
- Keep handoff status and landing SHA in frontmatter; preserve the handoff body.
- Put long material in an artifact. Do not output national ID numbers, health information, or bank account numbers.
- Local CLI changes reach the live runtime only after the documented runtime deploy.

## Route to details

- Delegation, room replies, run recovery, queue health, and blind review: [commands-and-review](references/commands-and-review.md).
- Formation, Council, UI, and skill distribution operations: [formation-and-owner-operations](references/formation-and-owner-operations.md).
- Handoff creation and resolution: [handoffs](references/handoffs.md).
