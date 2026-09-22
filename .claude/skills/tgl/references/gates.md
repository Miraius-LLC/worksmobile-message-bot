# TGLのreview gateと再発防止

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

**pending prevention がある session では CLI が強制する。** `tgl dispatch` と、`--session` 付きの `tgl plan` は `--summary` / `--objective` に `file:line`・`skill:節名` または `prevention: none` が無いと拒否する。pending prevention が無い session では要求しない（誤拒否しない）。`tgl review resolve` は prevention コマンドを印字するだけで実行はしない。
