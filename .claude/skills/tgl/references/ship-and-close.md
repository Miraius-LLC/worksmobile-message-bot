# TGLのship・close・改善

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

Use [the TGL gates procedure](gates.md#prevention-after-resolve-not-only-finish) for the command and resolution rules.

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
