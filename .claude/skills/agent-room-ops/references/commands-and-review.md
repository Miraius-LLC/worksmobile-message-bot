# Roomコマンド・review・TGL

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
- Keep Discord room replies compact. Put long review details in artifacts or `<<<DETAIL>>>` if writing a headless response.
- Share run ids with the user when they may need to follow up later.

## Review Patterns

For triangular review:

1. Write your own analysis first when independence matters.
2. Send blind review requests with `delegate --blind`.
3. Fetch the replies only after your own position is fixed.
4. Record adopted and deferred points in the relevant issue, assignment, or TGL lane / Formation report.

For implementation handoff:

1. State repo, objective, current branch/worktree if relevant, and exact files or diff range.
2. Ask for the output you need: review findings, patch proposal, risk list, or verification plan.
3. 通常roomではCLIが対応する `--diff <range>` を使える。Formation内はこの添付経路を使わず、repoの `skills/formation/references/review.md` の固定path + sha256方式に従う。

## TGL Interaction

During TGL, update or check lane state before asking another agent to act:

```bash
agent-room tgl status --repo <repo>
```

When you are the lead, keep `status`, `next`, `touching`, and readiness current. Other agents should look at TGL status before touching nearby files or starting a competing slice.
