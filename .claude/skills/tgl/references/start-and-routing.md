# TGLの全体像・開始・routing

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

Routing判断（model id / effortの現在値は `tgl route` とrepoの `docs/agents/runtime.md` を正とする）:

- `ui_smoke`: Grok with the fixed read-only Playwright preflight
- normal first review: auto routing（Grok / Kimiを含む通常review候補）
- bounded rapid implementation: Grok / Kimi via `rapid_coder`
- final / integration review: Claude/Codex are the deep-review core, with Grok as the fast supporting vote; exclude the requesting lead and select two
- short bounded verifier: capabilityに適合するagent（model / effortは `tgl route` とrepoの `docs/agents/runtime.md` を確認） (evidence-only when `--verification` is unspecified in `read-only` mode; passing a non-blank `--verification` in `read-only` mode is blocked prior to event/inject as read-only runs do not execute commands — use `--mode work` for command execution)
- **never route `verifier` to Grok when verification requires running commands.** Grok's read-only profile denies shell outright (`GROK_READ_ONLY_DENY_RULES`), so it cannot run `bun test`, re-run a suite, or perform a mutation falsification. It correctly refuses to mark criteria met and the lane stalls a full round-trip (tgl_3a7d32ace94f). "Short bounded verification" in this policy means bounded *judgement*, not command execution — for command-executing verification pick an agent whose profile allows shell.
- designer / security reviewer: Claude then Codex
- work coder: Codex / Claude / agy work models, excluding the director when possible
- rapid coder: Grok / Kimi only for `mode=work`, `risk=bounded`, 1-8 explicit touching paths, and no sensitive/public-api/schema/migration/permission/deploy risk
- never auto-route agy Medium to broad final/integration review; its dogfood strength is short bounded work, not long repository-wide analysis

Then decide whether the work belongs on TGL and create the session with `tgl plan`:

```bash
agent-room tgl plan --repo <repo> --title <title> --director <agent> --objective <objective> \
  --touching <path> --touching <path> \
  --wip-limit 3 --pr-policy recommended --subagents limited
```

`tgl plan` creates the session and records a `tgl_plan` event. It judges split feasibility from `--touching`: two or more paths means `split feasible`; fewer means `split needs confirmation`, and it tells you to either add a real lane split or reject TGL for single-agent work. Add `--smoke ui` when the change needs UI smoke and `--risk sensitive` when it touches security-relevant surface; both set plan flags that later make `tgl gate` and the quality warnings demand a ui_smoke or security_reviewer role. Use `tgl start` only when you already know the split and do not need the plan judgment. Do not use plan to legitimize a single-agent lane monopoly.

ownerのTGL状況問い合わせはmentionなしでも扱う限定例外。現行本番はlocal + Discord Gateway。LINE WORKS / Slack ingress と Worker は停止済み。transportの現在値はrepoの `docs/runbook/chat-transports.md` を確認する。問い合わせ文の例:

```text
TGLの状況見せて
repo:agent-room TGL状況
```

旧Worker経路ではcompact TGL statusを直接返しagent runをenqueueしなかった。停止中のWorkerへ問い合わせる手順として使わず、CLIでは `agent-room tgl status --repo <repo>` を使う。

Create or identify:

- repo
- objective
- director agent
- base commit
- design gate reviewers
- lanes and lead agents
- canonical `touching` paths
- expected verification command
