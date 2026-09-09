---
name: agent-room-ops
description: Agent-room operation guide for coordinating Claude, Codex, and agy through the room instead of direct agent CLI calls. Use when an agent needs to delegate work or review, respond back into LINE WORKS, watch or retrieve run results, inspect queue or health status, coordinate TGL lanes, avoid repo confusion, or choose between delegate/respond/watch/reply/run/status/post/say.
---

# Agent Room Ops

Use agent-room as the coordination surface. Keep room history, run ids, repo labels, and artifacts traceable.

## First Rule

Do not call `claude -p`, `codex exec`, or `agy -p` directly to ask another agent for work unless Fujii explicitly asked for a direct local run. Use `agent-room delegate` or `agent-room respond` so the room can track the request.

Run `agent-room` from the target repo cwd. The agent-room implementation repo is not the target repo unless the work is for `repo:agent-room`.

## Command Choice

Use these commands by default:

```bash
agent-room delegate --from codex --to claude "repo:agent-room

依頼本文..."
```

Delegate review, research, implementation consultation, or blind review to another agent. Use `--blind` when triangulating: it suppresses watch and omits Recent room context from each target prompt so another vote cannot leak in. Use `--no-watch` only for automation that should not block.

To ask a separate headless run of the same logical agent for review, pass the same name explicitly. This is an owner-seeded new run, not recursive continuation:

```bash
agent-room delegate --from codex --to codex "repo:agent-room

別のCodexとしてこの差分をレビューしてください"
```

Explicit `--to <self>` is allowed. `--to all`, inferred mentions, and reply-driven continuation still exclude the sender to avoid accidental recursive runs.

```bash
agent-room respond --from codex --to agy "repo:agent-room

返答本文..."
```

Return an interactive session's answer to the room and optionally continue the discussion with another agent.

```bash
agent-room watch <run_id>
agent-room reply <run_id>
agent-room run <run_id>
```

Use `watch` while waiting, `reply` to fetch the reply body, and `run` when you need status plus full artifact links.

```bash
agent-room status --repo agent-room
agent-room status --health
agent-room tgl status --repo agent-room
```

Use `status` for queue / recent runs, `status --health` for silent failures or partial sends, and `tgl status` for active TGL sessions, lane owners, conflict risk, and ship queue.

Use `agent-room post` / `agent-room say` only for low-level posting. Prefer `delegate` and `respond` for normal coordination.

## Message Rules

- Write request text in Japanese. Code, paths, commit ranges, and command names may stay as-is.
- Include `repo:<name>` for repo-specific work. Do not use a branch, worktree, or directory name as the repo label.
- If the message contains paths like `src/...` or `docs/...`, confirm the repo label is present.
- Keep LINE WORKS replies compact. Put long review details in artifacts or `<<<DETAIL>>>` if writing a headless response.
- Share run ids with the user when they may need to follow up later.

## Review Patterns

For triangular review:

1. Write your own analysis first when independence matters.
2. Send blind review requests with `delegate --blind`.
3. Fetch the replies only after your own position is fixed.
4. Record adopted and deferred points in the relevant issue, assignment, or TGL lane.

For implementation handoff:

1. State repo, objective, current branch/worktree if relevant, and exact files or diff range.
2. Ask for the output you need: review findings, patch proposal, risk list, or verification plan.
3. Use `--diff <range>` when the existing CLI supports it and the reviewer needs the actual diff.

## Handoff Documents

Handoff notes live in `~/Develop/.agent-room/<repo>/handoffs/`. **A resolved handoff must look
different from an open one.** Without that, a reader has to read the whole document to learn
whether the work is still waiting (2026-09-07: a resolved handoff was indistinguishable from an
open one, and the resolution was hand-written at the end of the body).

Start every handoff with YAML frontmatter:

```yaml
---
status: open          # open | resolved
date: 2026-09-07      # when the handoff was written
resolved_commit:      # fill in when status becomes resolved; leave empty while open
---
```

Rules:

- `status: open` while the receiving side still has to act. `resolved` only after the work landed.
- When you resolve it, set `status: resolved` **and** put the landing SHA in `resolved_commit`.
  A resolution without a SHA is not resolvable back to what actually shipped.
- Do not delete a resolved handoff. The frontmatter is what makes it skippable.
- Keep the body as it is. The frontmatter is the index; the body is the record.

To list what is still open:

```bash
rg -l '^status: open$' ~/Develop/.agent-room/<repo>/handoffs/
```

Existing handoffs written before this rule have no frontmatter. Add it when you next touch one;
do not sweep them all at once.

## TGL Interaction

During TGL, update or check lane state before asking another agent to act:

```bash
agent-room tgl status --repo <repo>
```

When you are the lead, keep `status`, `next`, `touching`, and readiness current. Other agents should look at TGL status before touching nearby files or starting a competing slice.
