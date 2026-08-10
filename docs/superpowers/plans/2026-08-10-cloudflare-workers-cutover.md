# Cloudflare Workers 主系化・Cloud Run 待機化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` pushでCloudflare Workersへ自動デプロイし、`line-works.api.miraius.co.jp`をWorkersへ切り替えた後、Cloud Runをscale-to-zeroの待機系へ移す。

**Architecture:** `src/app.ts`をCloud RunとWorkersで共有する既存構造を維持し、通常CDだけをGitHub Actions→Wranglerへ切り替える。Custom Domainは`wrangler.jsonc`が所有し、infraはCloudflare resource/tokenの台帳と払い出しを担う。Cloud Runのコード・image・domain mappingは残し、Cloud Build triggerのみ停止して即時復帰可能にする。

**Tech Stack:** Bun 1.3.14、TypeScript 7、Hono 4、Wrangler 4.120.0、GitHub Actions、Cloudflare Workers、Cloud Run、Cloud Build、develop-meta/infra

## Global Constraints

- 本番hostnameは`line-works.api.miraius.co.jp`から変更しない。
- Workersを主系、Cloud Runを手動復旧用待機系とする。
- Cloud Run用の`src/index.ts`、`Dockerfile`、`cloudbuild.yaml`は削除しない。
- Cloud Run待機設定は`min-instances=0`、`max-instances=1`、`ingress=internal`とする。
- Cloud Build triggerは`main`反映前に停止し、Workers疎通後までCloud Run本体は公開状態を維持する。
- GitHub ActionsはCI成功済みの`main` commitだけをWorkersへdeployする。
- production deploy jobのexternal actionは全てcommit SHAへpinする（`actions/checkout`
  `d23441a48e516b6c34aea4fa41551a30e30af803`、`oven-sh/setup-bun`
  `0c5077e51419868618aeaa5fe8019c62421857d6`、`cloudflare/wrangler-action`
  `ebbaa1584979971c8614a24965b4405ff95890e0`）。
- Wrangler 4.120.0 bundled workerd対応上限の実測により`compatibility_date`は`2026-08-08`へ固定する。
- Custom Domainは`wrangler.jsonc`がSoT。Terraform DNS stackから二重管理しない。
- token/secrets/private keyはstdout、ログ、commitへ出さない。
- Workers deploy tokenは `workers-script-deploy` の最小権限（account: `Workers Scripts Write`、zone: `Workers Routes Write` / `DNS Write` / `Zone Read`）に限定する。`D1 Write` と `Workers R2 Storage Read` は付与しない。
- callbackの最終dedup防衛線は501側とし、切替前に既存テストで裏取りする。
- 外部書き込み、DNS切替、Cloud Build停止、Cloud Run更新、org repoの`main`反映は実行直前に藤井の承認を得る。
- unrelated dirty/untracked stateはstage・変更・削除しない。

## File Map

| File | Responsibility |
|---|---|
| `wrangler.jsonc` | Worker entrypoint、compatibility、Custom DomainのSoT |
| `wrangler-config.test.ts` | Wrangler deploy契約の回帰テスト |
| `.github/workflows/ci.yml` | CI成功後のWorkers production deploy |
| `ci-config.test.ts` | CI/deploy gate、action SHA、credential wiringの回帰テスト |
| `docs/adr/0010-cloudflare-workers-primary-cloud-run-standby.md` | 主系変更の設計判断 |
| `docs/adr/0001-cloud-run-hono-bun.md` | 旧主系判断のsuperseded表示 |
| `docs/adr/README.md` | ADR索引 |
| `README.md` | 現行runtime、通常deploy、待機/rollback runbook |
| `AGENTS.md` | エージェント向け現行architectureと運用ゴッチャ |
| `TODO.md` | Workers isolate間dedupの残課題を現行構成に同期 |
| `CHANGELOG.md` | 本番移行完了後の履歴 |
| `~/Develop/infra/registry/worksmobile-message-bot.yaml` | Worker/domain/token/GCP待機資産の横断台帳 |
| `~/Develop/infra/docs/services.md` | registry由来の生成サービス一覧 |
| `~/Develop/CHANGELOG.md` | infra台帳更新履歴 |

---

### Task 1: Custom DomainをWrangler設定へ固定する

**Files:**
- Modify: `wrangler-config.test.ts:1-20`
- Modify: `wrangler.jsonc:1-7`

**Interfaces:**
- Consumes: Wrangler 4.120.0の`routes[].pattern` / `routes[].custom_domain`
- Produces: `line-works.api.miraius.co.jp`をWorker `worksmobile-message-bot`へ結び付けるdeploy設定

- [ ] **Step 1: failing testを追加する**

`wrangler-config.test.ts`を次の型と期待値へ拡張する。

```ts
interface WranglerRoute {
  pattern?: string
  custom_domain?: boolean
}

interface WranglerConfig {
  name?: string
  main?: string
  compatibility_flags?: string[]
  routes?: WranglerRoute[]
}

// 既存expectの後へ追加
expect(config.routes).toEqual([
  {
    pattern: 'line-works.api.miraius.co.jp',
    custom_domain: true,
  },
])
```

- [ ] **Step 2: REDを確認する**

Run:

```bash
bun test wrangler-config.test.ts
```

Expected: `config.routes`が`undefined`のためFAIL。

- [ ] **Step 3: 最小設定を追加する**

`wrangler.jsonc`を次の形にする。

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "worksmobile-message-bot",
  "main": "src/worker.ts",
  "compatibility_date": "2026-08-08",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [
    {
      "pattern": "line-works.api.miraius.co.jp",
      "custom_domain": true,
    },
  ],
}
```

- [ ] **Step 4: GREENとbundle検証を行う**

Run:

```bash
bun test wrangler-config.test.ts
bunx wrangler deploy --dry-run
```

Expected: test PASS、dry-run成功。外部deployは発生しない。

- [ ] **Step 5: commitする**

```bash
git add wrangler.jsonc wrangler-config.test.ts
git commit -m '🚀 WorkersのCustom Domainを固定'
```

---

### Task 2: CI成功後のWorkers deploy gateを追加する

**Files:**
- Create: `ci-config.test.ts`
- Modify: `.github/workflows/ci.yml:1-45`

**Interfaces:**
- Consumes: GitHub Secret `CLOUDFLARE_API_TOKEN`、GitHub Variable `CLOUDFLARE_ACCOUNT_ID`
- Produces: `check`成功済み`main` commitだけを`wrangler deploy`する`deploy` job

- [ ] **Step 1: workflow contractのfailing testを書く**

`ci-config.test.ts`を新設する。

```ts
import { describe, expect, test } from 'bun:test'

interface WorkflowStep {
  id?: string
  uses?: string
  with?: Record<string, string>
}

interface WorkflowJob {
  needs?: string
  if?: string
  concurrency?: {
    group?: string
    'cancel-in-progress'?: boolean
  }
  steps?: WorkflowStep[]
}

interface WorkflowConfig {
  on?: Record<string, unknown>
  jobs?: Record<string, WorkflowJob>
}

describe('CI workflow', () => {
  test('CI成功済みmainだけをSHA pinしたWrangler actionでdeployする', async () => {
    const source = await Bun.file(new URL('./.github/workflows/ci.yml', import.meta.url)).text()
    const workflow = Bun.YAML.parse(source) as WorkflowConfig
    const deploy = workflow.jobs?.deploy
    const deployStep = deploy?.steps?.find(step => step.id === 'deploy')

    expect(workflow.on).toHaveProperty('workflow_dispatch')
    expect(deploy?.needs).toBe('check')
    expect(deploy?.if).toContain("github.ref == 'refs/heads/main'")
    expect(deploy?.concurrency).toEqual({
      group: 'cloudflare-workers-production',
      'cancel-in-progress': true,
    })
    expect(deployStep?.uses).toBe(
      'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0',
    )
    expect(deployStep?.with).toMatchObject({
      apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      accountId: '${{ vars.CLOUDFLARE_ACCOUNT_ID }}',
      wranglerVersion: '4.120.0',
      packageManager: 'bun',
    })
  })
})
```

- [ ] **Step 2: REDを確認する**

Run:

```bash
bun test ci-config.test.ts
```

Expected: `workflow_dispatch`または`jobs.deploy`不在でFAIL。

- [ ] **Step 3: workflowを最小実装する**

`.github/workflows/ci.yml`へ`workflow_dispatch`と次のjobを追加する。既存`check` jobは変更しない。

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  # 既存 check job

  deploy:
    name: Deploy to Cloudflare Workers
    needs: check
    if: >-
      github.ref == 'refs/heads/main' &&
      (github.event_name == 'push' || github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    concurrency:
      group: cloudflare-workers-production
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6

      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
        with:
          bun-version-file: .tool-versions

      - name: Install dependencies
        run: |
          set +e
          installOutput="$(bun install --frozen-lockfile 2>&1)"
          installStatus=$?
          set -e
          printf '%s\n' "$installOutput"
          if [ "$installStatus" -eq 0 ]; then
            exit 0
          fi
          if printf '%s\n' "$installOutput" | grep -q 'Socket Security Scanner: Received 429 from server'; then
            echo "::warning::Socket authenticated scan hit 429; retrying bun install without SOCKET_API_KEY."
            unset SOCKET_API_KEY
            bun install --frozen-lockfile
          else
            exit "$installStatus"
          fi
        env:
          SOCKET_API_KEY: ${{ secrets.SOCKET_API_KEY }}

      - name: Deploy Worker
        id: deploy
        uses: cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: '4.120.0'
          packageManager: bun
          command: deploy --message "GitHub Actions ${{ github.sha }}"

      - name: Add deployment summary
        env:
          DEPLOYMENT_URL: ${{ steps.deploy.outputs.deployment-url }}
        run: |
          echo '### Cloudflare Workers deployment' >> "$GITHUB_STEP_SUMMARY"
          echo "- Commit: \`$GITHUB_SHA\`" >> "$GITHUB_STEP_SUMMARY"
          echo "- URL: $DEPLOYMENT_URL" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 4: workflow testとactionlintを通す**

Run:

```bash
bun test ci-config.test.ts
mise x actionlint@1.7.12 -- actionlint .github/workflows/ci.yml
```

Expected: PASS、actionlint outputなし。

- [ ] **Step 5: commitする**

```bash
git add .github/workflows/ci.yml ci-config.test.ts
git commit -m '🚀 main pushからWorkersへ自動デプロイ'
```

---

### Task 3: 主系変更をADR・運用docsへ反映する

**Files:**
- Create: `docs/adr/0010-cloudflare-workers-primary-cloud-run-standby.md`
- Modify: `docs/adr/0001-cloud-run-hono-bun.md:1-4`
- Modify: `docs/adr/README.md:10-32`
- Modify: `README.md:14-210,820-885`
- Modify: `AGENTS.md`
- Modify: `TODO.md:14-22`

**Interfaces:**
- Consumes: 承認済み設計書`docs/superpowers/specs/2026-08-10-cloudflare-workers-cutover-design.md`
- Produces: 現行runtime/CD/rollback/dedup前提のSoT

- [ ] **Step 1: ADR-0010をacceptedで作成する**

`docs/adr/0010-cloudflare-workers-primary-cloud-run-standby.md`へ次の判断を標準テンプレートで記載する。

```markdown
---
status: accepted
date: 2026-08-10
---

# ADR-0010: Cloudflare Workersを主系、Cloud Runを待機系とする

## Context and Problem Statement

Cloud Runの常時1 instance構成を、同じHono appを実行できるCloudflare Workersへ移し、通常deployとidle costを簡素化する。一方、LINE WORKS gatewayの障害時にCloud Runへ短時間で戻せる経路は維持する。

## Decision Drivers

- `main` pushから本番へ一貫してdeployできること
- `line-works.api.miraius.co.jp`を変更しないこと
- Cloud Runのidle compute costを止めること
- Workers障害時に既存Cloud Run serviceへ戻せること
- runtime固有entrypoint以外のapp実装を共有すること

## Considered Options

- Workersを主系、Cloud Runをscale-to-zeroの待機系にする
- Cloud Run serviceを削除し、コードだけ残す
- WorkersとCloud Runを毎回同時deployする

## Decision Outcome

Chosen option: 「Workersを主系、Cloud Runをscale-to-zeroの待機系にする」

### Consequences

- Good: 通常deployがGitHub Actions→Workersへ一本化され、Cloud Runのidle compute costを止められる
- Bad: Worker isolate間でin-memory dedupを共有できず、501側dedupへ最終防衛を依存する
- Neutral: Cloud Run用Docker/Cloud Build/Secret Manager/Artifact Registryはrollback資産として残る

### Confirmation

`wrangler-config.test.ts`と`ci-config.test.ts`でCustom Domainとdeploy gateを固定し、切替時はWorkers deployment、DNS/TLS、`/healthz`、BASIC認証、501 callback、Cloud Run scaling/ingress、Cloud Build trigger disabledを実測する。
```

- [ ] **Step 2: ADR索引と旧ADR statusを更新する**

`docs/adr/0001-cloud-run-hono-bun.md`のfrontmatterだけを次へ変更する。

```yaml
---
status: superseded by ADR-0010
date: 2026-05-11
---
```

`docs/adr/README.md`の基盤/実行環境へ次を追加する。

```markdown
- [0010](./0010-cloudflare-workers-primary-cloud-run-standby.md) — Cloudflare Workersを主系、Cloud Runを待機系とする（0001をsupersede）
```

- [ ] **Step 3: READMEとAGENTSを現在形へ直す**

次の事実を明記し、Cloud Run主系・`min-instances=1`必須という旧説明を置換する。

```markdown
- 通常CD: GitHub ActionsのCI成功後にCloudflare Workersへdeploy
- 本番hostname: `line-works.api.miraius.co.jp`（Workers Custom Domain）
- Cloud Run: `min-instances=0` / `max-instances=1` / internal ingressの待機系
- Cloud Run復帰: 既存imageのまま`gcloud run services update`でingress/scalingを戻し、
  Workers Domain解除→永続fallback profileのCNAME復元→DNS/health確認まで実行する
- callback dedup: wmbot内Mapはbest effort、501側Mapを最終防衛線とする
```

Cloud Runの手動deploy手順は削除せず、無効化済みtriggerを再有効化しない公開failover
deployとして記録する。`gcloud builds submit`ではtrigger専用の`REPO_NAME` / `COMMIT_SHA` /
`SHORT_SHA`をgitから実測し、必須の`_CLIENT_ID` / `_SERVICE_ACCOUNT_LW` / `_BOT_ID`は
`secrets:inject`で生成した`.env`から値を履歴やlogへ表示せず渡す。この3値はCloud Build
metadataを閲覧できる利用者には見える低機密substitutionであり、Secret Manager値は渡さない。
`.gcloudignore`で`.git`と`.env` / `.env.*`をsource uploadから除外し、手動buildは
`set -euo pipefail`のsubshell内で実行して親shellへenvを残さない。

- [ ] **Step 4: TODOのdedup記述を現行構成へ同期する**

backlogは完了扱いにせず、次の条件を残す。

```markdown
- [ ] **dedup を共有ストア化（Workers KV / Durable Objects 等）** — Workers isolate間でwmbot内Mapは共有されない。現状は501側dedupを最終防衛線とし、gateway単体で厳密な一回処理が必要になった時だけ共有ストア化する。
```

- [ ] **Step 5: docs検証を行う**

Run:

```bash
git diff --check
~/Develop/bin/check-project-integrity worksmobile-message-bot
rg -n "主系|min-instances=1|Cloud Build.*通常|Cloud Run.*通常" README.md AGENTS.md TODO.md docs/adr
```

Expected: integrity PASS。旧主系記述はlegacy Original Recordまたは明示した待機復帰説明に限定される。

- [ ] **Step 6: commitする**

```bash
git add README.md AGENTS.md TODO.md docs/adr
git commit -m '📝 Workers主系とCloud Run待機系の運用を同期'
```

---

### Task 4: infra台帳へWorker/domain/token責務を登録する

**Files:**
- Modify: `~/Develop/infra/registry/worksmobile-message-bot.yaml`
- Modify: `~/Develop/infra/docs/services.md`
- Modify: `~/Develop/CHANGELOG.md`

**Interfaces:**
- Consumes: Cloudflare account `91583d32ef3c554d0b22855c9167752f`、zone `5811b0a77c84211a69f3a48e4443ce03`
- Produces: infra registryからWorker、Custom Domain、deploy credentialの所在を追跡できる台帳

- [ ] **Step 1: develop-meta専用worktreeを作る**

Run from `~/Develop`:

```bash
git status --short
git worktree add .claude/worktrees/wmbot-workers-infra -b worktree-wmbot-workers-infra
```

Expected: mainの既存dirty stateを変更せず、新規worktree作成。

- [ ] **Step 2: registryへCloudflare sectionを追加する**

token作成前は`token_id`を省略し、次を記録する。

```yaml
cloudflare:
  account_id: 91583d32ef3c554d0b22855c9167752f
  workers:
    - name: worksmobile-message-bot
      routes:
        - line-works.api.miraius.co.jp
      compatibility_date: '2026-08-08'
      r2_buckets: []
      kv_namespaces: []
      d1_databases: []
      images_bindings: []
      hyperdrive: []
  zones:
    - domain: miraius.co.jp
      zone_id: 5811b0a77c84211a69f3a48e4443ce03
      name_servers:
        - graham.ns.cloudflare.com
        - katelyn.ns.cloudflare.com
      status: active
  api_tokens:
    - name: worksmobile-message-bot-deploy
      usage: GitHub Actions deploy (Workers + Custom Domain)
      policies:
        - 'account: Workers Scripts Write'
        - 'zone: Workers Routes Write'
        - 'zone: DNS Write'
        - 'zone: Zone Read'
      stored_at:
        - 'github:Miraius-LLC/worksmobile-message-bot CLOUDFLARE_API_TOKEN'
        - 'op://Worksmobile/Cloudflare/api_token'
```

`services`へ次を追加し、既存LINE WORKS entryは保持する。

```yaml
  - { kind: github-actions, category: ops, usage: 'Cloudflare Workers 自動デプロイ' }
```

`secrets`を次で有効化する。

```yaml
secrets:
  op_vault: Worksmobile
  op_items:
    - Cloudflare
```

- [ ] **Step 3: registryと生成docsを検証する**

Run from infra worktree:

```bash
bun install --frozen-lockfile
bun run registry:doctor
bun run bin/registry-show --markdown
bun test src/registry
```

Expected: schema PASS。token_id未発行の警告以外に新規errorなし。`infra/docs/services.md`へwmbotのGitHub Actions利用が追加される。

- [ ] **Step 4: infra CHANGELOGを追加する**

`~/Develop/CHANGELOG.md`先頭へ次の粒度で追加する。

```markdown
- v1.26 (2026-08-10): worksmobile-message-botのCloudflare Worker、Custom Domain、Workers deploy token保管先をinfra registryへ台帳化し、Cloud Runはrollback資産として併記した。
```

実装直前に`CHANGELOG.md`先頭が引き続き`v1.25`であることを確認する。別変更が先行していた場合は衝突として止め、番号を推測しない。

- [ ] **Step 5: commitする**

```bash
git add infra/registry/worksmobile-message-bot.yaml infra/docs/services.md CHANGELOG.md
git commit -m '🔧 wmbotのWorkers運用をinfra台帳化'
```

---

### Task 5: 最小権限のzone限定deploy tokenとGitHub credentialを準備する

**Files:**
- Modify: `~/Develop/infra/registry/worksmobile-message-bot.yaml`（実token IDのみ追記）

**Interfaces:**
- Consumes: infra provisioner、1Password vault `Worksmobile`、Cloudflare zone ID
- Produces: `op://Worksmobile/Cloudflare/api_token`、GitHub Secret/Variable

- [ ] **Step 1: 外部書き込み内容を提示して承認を得る**

提示内容:

```text
Cloudflare: account 91583... に worksmobile-message-bot-deploy tokenを1件作成
scope: accountのWorkers Scripts Writeのみ、miraius.co.jp zoneのWorkers Routes/DNS Write/Zone Read
除外: D1 Write / Workers R2 Storage Read（このWorkerでは不要）
1Password: Worksmobile/Cloudflareへtoken metadataとconcealed api_tokenを保存
GitHub: Miraius-LLC/worksmobile-message-botへCLOUDFLARE_API_TOKEN secretとCLOUDFLARE_ACCOUNT_ID variableを設定
rollback: GitHub secret/variable削除、Cloudflare token revoke、registry entry削除
```

- [ ] **Step 2: 1Passwordを対話認証し、dry-runする**

Run from infra worktree:

```bash
op signin
bun run provision:cf-api-token -- \
  --project=worksmobile-message-bot \
  --kind=workers-script-deploy \
  --zone-id=5811b0a77c84211a69f3a48e4443ce03 \
  --op-vault=Worksmobile \
  --op-item=Cloudflare \
  --dry-run
```

Expected: API/op writeなし。token name、account、zone、permissionだけを表示。

- [ ] **Step 3: 承認後にtokenを発行する**

```bash
bun run provision:cf-api-token -- \
  --project=worksmobile-message-bot \
  --kind=workers-script-deploy \
  --zone-id=5811b0a77c84211a69f3a48e4443ce03 \
  --op-vault=Worksmobile \
  --op-item=Cloudflare
```

Expected: token値は表示されず、`op://Worksmobile/Cloudflare/*`の保存先だけを表示。

- [ ] **Step 4: GitHub credentialへ値を表示せず登録する**

```bash
op read 'op://Worksmobile/Cloudflare/api_token' | \
  gh secret set CLOUDFLARE_API_TOKEN --repo Miraius-LLC/worksmobile-message-bot

gh variable set CLOUDFLARE_ACCOUNT_ID \
  --body '91583d32ef3c554d0b22855c9167752f' \
  --repo Miraius-LLC/worksmobile-message-bot

gh secret list --repo Miraius-LLC/worksmobile-message-bot
gh variable list --repo Miraius-LLC/worksmobile-message-bot
```

Expected: secretは名前と更新日時のみ、variableはaccount ID一致。

- [ ] **Step 5: 実token IDをregistryへ記録する**

```bash
op read 'op://Worksmobile/Cloudflare/token_id'
```

表示された非secretのtoken IDを`worksmobile-message-bot-deploy` entryの`token_id`へ`apply_patch`で追加する。その後:

```bash
bun run registry:doctor
bun run registry:doctor:live
git add infra/registry/worksmobile-message-bot.yaml
git commit -m '🔧 Workers deploy token IDを実測で同期'
```

Expected: live doctorでtoken name/ID/policies一致。

- [ ] **Step 6: develop-metaへff-only反映・pushする**

Run from `~/Develop` main:

```bash
git merge --ff-only worktree-wmbot-workers-infra
git push origin main
git rev-list --left-right --count main...origin/main
```

Expected: `0 0`。CI成功後にinfra worktreeを削除する。

---

### Task 6: 切替前verificationとARコードレビューを完了する

**Files:**
- No new files

**Interfaces:**
- Consumes: Tasks 1-5のbranch/credential/infra state
- Produces: 本番切替可能なGO evidence

- [ ] **Step 1: appの全検証を実行する**

```bash
bunx tsc --noEmit
bunx biome check ./src ./tests ./scripts ci-config.test.ts wrangler-config.test.ts operations-config.test.ts
bun test
bunx wrangler deploy --dry-run
mise x actionlint@1.7.12 -- actionlint .github/workflows/ci.yml
~/Develop/bin/check-infra-ownership
~/Develop/bin/check-project-integrity worksmobile-message-bot
git diff --check
```

Expected: 全てexit 0、Workers bundleは生成のみでdeployなし。

- [ ] **Step 2: 501側dedupを実証する**

Run from `~/Develop/501`:

```bash
bun test tests/callback/route.test.ts src/services/lineworks/callback/dedup.test.ts
```

Expected: 同一callbackの2回目がdispatch/fetchされないtestを含め全PASS。

- [ ] **Step 3: feature branchをpushする**

```bash
git push -u origin worktree-cloudflare-workers-cutover
```

Expected: pre-pushの558件以上がPASSし、remote branch更新。

- [ ] **Step 4: ClaudeとagyへAR final reviewを依頼する**

```bash
agent-room delegate --blind -f codex -t claude,agy \
  --diff origin/main..HEAD \
  "@claude @agy repo:worksmobile-message-bot Workers主系化の実装差分をread-onlyで独立レビューしてください。観点: CI deploy gate、credential漏洩、Custom Domain、Cloud Run rollback、docs drift、テスト。問題点→改善案→GO/NO-GOで返答。本番操作禁止。"
```

Expected: 両レビュー回収。High/CriticalまたはNO-GOを解消し、修正時は該当test→全test→再pushする。

- [ ] **Step 5: branch状態を固定する**

```bash
git status --short
git rev-list --left-right --count HEAD...origin/worktree-cloudflare-workers-cutover
```

Expected: clean、`0 0`。

2026-08-10 live evidence: 最小権陙tokenのWorkers Domains Listは`success=true`、対象は
切替前のため0件。同tokenのDNS GETはCNAME `ghs.googlehosted.com`、TTL `1`（Auto）、
proxied falseを返した。Cloudflare公式仕様でListは`Workers Scripts Write`またはRead、
Detachは`Workers Scripts Write`。既存tokenはWriteを持つが、DetachはTask 7の承認後まで実行しない。
参照: [List Domains](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/)、
[Detach Domain](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/delete/)。

---

### Task 7: Cloud Build自動deployを停止し、Workersへ切り替える

**Files:**
- External state only

**Interfaces:**
- Consumes: approved app branch、GitHub credential、現行CNAME/Cloud Run
- Produces: Workers Custom Domain production traffic

- [ ] **Step 1: 本番変更の最終承認を得る**

提示内容:

```text
変更: Cloud Build trigger disabled、org repo mainへff-only反映、GitHub ActionsからWorkers deploy、CNAMEをWrangler Custom Domainへ置換
現在: CNAME ghs.googlehosted.com TTL 1 (Cloudflare Auto) / Cloud Run min=1 / Worker secrets 9件
NO-GO: Custom Domain/TLS/health/BASIC/Callbackのいずれかが10分以内に成立しない
rollback: Workers Domain解除→CNAME復元。Cloud Runはこの時点では公開状態のまま
```

- [ ] **Step 2: 現行resourceを再取得する**

```bash
gcloud builds triggers describe 6f86686c-3e42-440d-aaf3-26a17c397620 \
  --project office-381404 --format='yaml(id,name,disabled,resourceName)'
gcloud run services describe worksmobile-message-bot \
  --region asia-northeast1 \
  --format='yaml(status.url,status.latestReadyRevisionName,spec.template.metadata.annotations)'
bunx wrangler deployments status --name worksmobile-message-bot
bunx wrangler versions list --name worksmobile-message-bot
dig +noall +answer line-works.api.miraius.co.jp CNAME
```

Expected: trigger enabled、Cloud Run ready、Workers current version、CNAME TTL `1`（Auto）を再確認。表示された最新version IDをWorker code regression時のrollback基準として記録する（secret値は表示しない）。

- [ ] **Step 3: Cloud Build triggerをdisabledにする**

```bash
(
  set -euo pipefail
  readonly wmbot_trigger_id='6f86686c-3e42-440d-aaf3-26a17c397620'
  trigger_json="$(gcloud builds triggers describe "$wmbot_trigger_id" \
    --project=office-381404 \
    --format=json)"
  trigger_update="$(jq '
    {resourceName,id,description,name,tags,github,filename,includeBuildLogs,
      serviceAccount,substitutions,disabled:true}
  ' <<<"$trigger_json")"
  unset api_bearer_token
  api_bearer_token="$(gcloud auth print-access-token)"
  printf '%s' "$trigger_update" | \
    curl --config <(printf 'header = "Authorization: Bearer %s"\n' "$api_bearer_token") \
    --fail-with-body --silent --show-error \
    --request PATCH \
    --url "https://cloudbuild.googleapis.com/v1/projects/office-381404/locations/global/triggers/$wmbot_trigger_id?updateMask=disabled" \
    --header 'Content-Type: application/json' \
    --data-binary @- | \
    jq -e --arg id "$wmbot_trigger_id" '.id == $id and .disabled == true' >/dev/null

  gcloud builds triggers describe "$wmbot_trigger_id" \
    --project=office-381404 \
    --format=json | \
    jq -e '.disabled == true' >/dev/null
)
```

Expected: `disabled: true`。Cloud Run本体/DNSはまだ変更しない。

2026-08-10 live evidence: `updateMask=disabled`でbodyを`{"disabled":true}`だけにすると
HTTP 400 `INVALID_ARGUMENT`。trigger未変更を確認後、既存trigger JSONの必要fieldを保持した
full bodyでPATCHし、再GETで`disabled=true`を確認済み。substitution値とaccess tokenは
stdout・log・argv/environmentへ出していない。

- [ ] **Step 4: live CNAMEを永続fallback profileと比較する**

```bash
(
  set -euo pipefail
  readonly wmbot_fallback_profile='docs/operations/cloud-run-dns-fallback.json'
  bearer_api() {
    local method="$1"
    shift
    printf 'header = "Authorization: Bearer %s"\n' "$api_bearer_token" | \
      curl --config - --fail-with-body --silent --show-error \
        --request "$method" "$@"
  }

  unset api_bearer_token
  api_bearer_token="$(op read 'op://Worksmobile/Cloudflare/api_token')"
  wmbot_dns_live="$(bearer_api GET \
    --url 'https://api.cloudflare.com/client/v4/zones/5811b0a77c84211a69f3a48e4443ce03/dns_records' \
    --get --data-urlencode 'name=line-works.api.miraius.co.jp')"

  jq -e \
    --arg hostname "$(jq -er '.hostname' "$wmbot_fallback_profile")" \
    --arg type "$(jq -er '.type' "$wmbot_fallback_profile")" \
    --arg content "$(jq -er '.content' "$wmbot_fallback_profile")" \
    --argjson ttl "$(jq -er '.ttl' "$wmbot_fallback_profile")" \
    --argjson proxied "$(jq -r '.proxied | tostring' "$wmbot_fallback_profile")" '
      .success == true and
      (.result | length == 1) and
      (.result[0] | .name == $hostname and .type == $type and .content == $content and
        .ttl == $ttl and .proxied == $proxied)
    ' <<<"$wmbot_dns_live" >/dev/null
)
```

Expected: 1件、content=`ghs.googlehosted.com`、ttl=`1`（Auto）、proxied=`false`でprofileと
完全一致。不一致なら切替を停止し、profileを勝手に上書きしない。CNAMEは手動削除しない。

- [ ] **Step 5: org repo main反映の確認後にff-only merge/pushする**

Run from main worktree after藤井の明示確認:

```bash
git fetch origin
wmbot_cutover_base="$(git rev-parse HEAD)"
git merge --ff-only worktree-cloudflare-workers-cutover
git push origin main
```

Expected: pre-push PASS。Cloud BuildはdisabledのためCloud Run deployは起動せず、GitHub Actionsの`check`→`deploy`だけが進む。

- [ ] **Step 6: GitHub ActionsとWorkers deployを監視する**

```bash
gh run list --workflow CI --branch main --limit 3 \
  --json databaseId,headSha,status,conclusion,url
gh run watch "$(gh run list --workflow CI --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
bunx wrangler deployments status --name worksmobile-message-bot
dig +noall +answer line-works.api.miraius.co.jp
curl -fsS https://line-works.api.miraius.co.jp/healthz
```

Expected: CI/deploy success、production version更新、`{"status":"ok"}`。Wrangler非TTY deployが既存CNAMEをCustom Domain recordへ置換する。

- [ ] **Step 7: BASIC認証とCallbackを確認する**

```bash
test "$(curl -sS -o /dev/null -w '%{http_code}' \
  https://line-works.api.miraius.co.jp/channels/invalid/messages/type/text)" = '401'
```

Expected: `401`。

認証付き代表requestは既存BASIC credentialを値非表示で読み、破壊操作を行わないGET routeへ送る。藤井がLINE WORKS self channelから`/status`を1件送信し、応答1件・重複なしを確認する。

- [ ] **Step 8: NO-GOなら即時rollbackする**

10分以内にTLS/health/BASIC/Callbackのいずれかが成立しない場合のみ実行する。

README「Workers障害時の即時復帰（既存 image）」のfail-closed blockを、藤井の明示承認後に
そのまま実行する。このblockは次を強制する。

- Workers Domainのhostname完全一致1件、Detach応答の`success=true`
- DNS record 0件ならPOST、1件ならprofile完全一致時だけno-op、不一致または2件以上は停止
- `docs/operations/cloud-run-dns-fallback.json`のCNAME / TTL `1`（Auto）/ proxiedと更新後GETの完全一致
- `/healthz` 200と未認証route 401の厳密一致
- tokenをstdinのcurl configへのみ渡し、子processのargv/environmentに載せない
- `set -euo pipefail`のsubshellによるtokenと一時envの破棄

Expected: Cloud Run CNAME復元。main差分は`git revert`で新規commitとして戻し、force/rebase/amendは使わない。

Cloud Build triggerを再有効化する場合も簡略bodyは使わず、既存trigger JSONを保持した
full bodyを送る。外部経路復元と同じく、藤井の明示承認後だけ実行する。

```bash
(
  set -euo pipefail
  readonly wmbot_trigger_id='6f86686c-3e42-440d-aaf3-26a17c397620'
  trigger_json="$(gcloud builds triggers describe "$wmbot_trigger_id" \
    --project=office-381404 \
    --format=json)"
  trigger_update="$(jq '
    {resourceName,id,description,name,tags,github,filename,includeBuildLogs,
      serviceAccount,substitutions,disabled:false}
  ' <<<"$trigger_json")"
  unset api_bearer_token
  api_bearer_token="$(gcloud auth print-access-token)"
  printf '%s' "$trigger_update" | \
    curl --config <(printf 'header = "Authorization: Bearer %s"\n' "$api_bearer_token") \
    --fail-with-body --silent --show-error \
    --request PATCH \
    --url "https://cloudbuild.googleapis.com/v1/projects/office-381404/locations/global/triggers/$wmbot_trigger_id?updateMask=disabled" \
    --header 'Content-Type: application/json' \
    --data-binary @- | \
    jq -e --arg id "$wmbot_trigger_id" '.id == $id and .disabled == false' >/dev/null

  gcloud builds triggers describe "$wmbot_trigger_id" \
    --project=office-381404 \
    --format=json | \
    jq -e '.disabled == false' >/dev/null
)
```

外部経路を復元した後、同じterminalで次を実行してmainの移行差分も打ち消す。

```bash
test -n "$wmbot_cutover_base"
git revert --no-edit "$wmbot_cutover_base"..HEAD
git push origin main
```

Expected: revert commitのCIがPASSし、Cloud Build triggerを再有効化した後はCloud Run通常deploy経路へ戻る。

- [ ] **Step 9: GOなら30分監視する**

30分間、5分以下の間隔で次を再確認する。長いblocking sleepは使わない。

```bash
curl -fsS https://line-works.api.miraius.co.jp/healthz
bunx wrangler deployments status --name worksmobile-message-bot
gh run list --workflow CI --branch main --limit 1 \
  --json headSha,status,conclusion,url
```

Expected: health 200、deployment不変、追加error/duplicate callbackなし。Cloud Runはこの監視終了まで公開状態を維持。

---

### Task 8: Cloud Runを待機化する

**Files:**
- External state only

**Interfaces:**
- Consumes: 30分正常監視済みWorkers production
- Produces: idle compute 0のCloud Run standby

- [ ] **Step 1: 待機化内容を再提示して承認を得る**

```text
対象: Cloud Run service worksmobile-message-bot / asia-northeast1
変更: ingress all→internal、min 1→0、max 20→1
維持: service、revision/image、IAM、Secret Manager、domain mapping、cloudbuild.yaml
rollback: ingress=all、min=1、max=20へ既存imageのままupdate
```

- [ ] **Step 2: Cloud Runをscale-to-zero/internalへ更新する**

```bash
gcloud run services update worksmobile-message-bot \
  --project office-381404 \
  --region asia-northeast1 \
  --ingress=internal \
  --min-instances=0 \
  --max-instances=1 \
  --quiet
```

Expected: 新revision ready、外部traffic source拒否、minimum instance 0。

- [ ] **Step 3: 実設定を検証する**

```bash
gcloud run services describe worksmobile-message-bot \
  --project office-381404 \
  --region asia-northeast1 \
  --format='yaml(metadata.annotations,status.latestReadyRevisionName,status.url,spec.template.metadata.annotations)'

curl -sS -o /dev/null -w '%{http_code}\n' \
  https://worksmobile-message-bot-6dkxmuzina-an.a.run.app/healthz

curl -fsS https://line-works.api.miraius.co.jp/healthz
```

Expected: annotationsが`minScale: 0` / `maxScale: 1` / internal ingress、default Cloud Run URLは外部利用不可、Custom Domainは200。

- [ ] **Step 4: 10分監視する**

```bash
gcloud run services describe worksmobile-message-bot \
  --region asia-northeast1 \
  --format='value(spec.template.metadata.annotations.autoscaling.knative.dev/minScale)'
bunx wrangler deployments status --name worksmobile-message-bot
curl -fsS https://line-works.api.miraius.co.jp/healthz
```

Expected: minScale `0`、Workers health正常、callback errorなし。

- [ ] **Step 5: 待機化後のrollback commandを実行せず検査する**

runbookの復帰commandが次であることを確認する。

```bash
gcloud run services update worksmobile-message-bot \
  --project office-381404 \
  --region asia-northeast1 \
  --ingress=all \
  --min-instances=1 \
  --max-instances=20
```

Expected: このstepでは表示・レビューのみ。実行しない。

---

### Task 9: 実状態をCHANGELOGへ確定しcloseoutする

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`（実測値driftがあった場合のみ）
- Modify: `TODO.md`（移行後follow-upだけ）

**Interfaces:**
- Consumes: 実際のWorkers version、GitHub Actions run、Cloud Run standby state
- Produces: 完了履歴、remote equality、clean worktree

- [ ] **Step 1: CHANGELOGへ実績を追加する**

`CI / CD・基盤`の先頭へ次の事実を、実run/version確認後に記載する。

```markdown
- **Cloudflare Workers主系化**: `main` pushのCI成功後にWranglerで自動deployし、`line-works.api.miraius.co.jp`をCustom Domainとして配信。Cloud Build triggerを停止し、Cloud Runは`min=0` / `max=1` / internal ingressの待機系へ移行。Docker/Cloud Build/Secret Managerはrollback経路として維持。
```

- [ ] **Step 2: 翌日確認をTODOへ残す**

深夜切替の完了条件と混ぜず、次を進行中へ追加する。

```markdown
- [ ] **Workers移行24時間後確認** — Workers logs/Callback error、Cloud Run instance 0、GitHub Actions deploy、duplicate応答なしを翌日確認し、問題なければ本項目を完了履歴へ移す。
```

- [ ] **Step 3: docs-only commitと自動deployを検証する**

```bash
git add CHANGELOG.md TODO.md README.md
git commit -m '📝 Workers移行実績と翌日確認を記録'
git push origin main
gh run watch "$(gh run list --workflow CI --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: docs commitでもCI→Workers deploy成功、Cloud Run triggerはdisabledのまま。

- [ ] **Step 4: remote equalityと外部stateを最終確認する**

```bash
git rev-list --left-right --count main...origin/main
git status --short
gcloud builds triggers describe 6f86686c-3e42-440d-aaf3-26a17c397620 \
  --format='value(disabled)'
gcloud run services describe worksmobile-message-bot \
  --region asia-northeast1 \
  --format='yaml(spec.template.metadata.annotations,status.latestReadyRevisionName)'
bunx wrangler deployments status --name worksmobile-message-bot
curl -fsS https://line-works.api.miraius.co.jp/healthz
```

Expected: `0 0`、clean、trigger `True`、Cloud Run min 0/max 1、Workers current、health 200。

- [ ] **Step 5: merged worktree/branchを安全に片付ける**

mainへのmerge、push、CI/deploy、remote equalityが全て成功し、藤井が対象名を確認した後だけ実行する。

```bash
git worktree remove .claude/worktrees/cloudflare-workers-cutover
git branch -d worktree-cloudflare-workers-cutover
git push origin --delete worktree-cloudflare-workers-cutover

git -C ~/Develop worktree remove ~/Develop/.claude/worktrees/wmbot-workers-infra
git -C ~/Develop branch -d worktree-wmbot-workers-infra
```

Expected: 対象worktree/merged branchだけを削除。unrelated worktree・untracked fileは保持。

---

## Final Evidence Checklist

- [ ] app branchの全test/typecheck/biome/actionlint/wrangler dry-runがPASS
- [ ] Claude/agy AR final reviewがGO
- [ ] infra registry doctor/liveがtoken ID/policies/domain一致
- [ ] Cloud Build trigger disabled
- [ ] GitHub Actions `check`→`deploy` success、commit SHA一致
- [ ] Workers Custom DomainのTLS/health/BASIC認証正常
- [ ] `/status` callbackが501経由で1応答、duplicateなし
- [ ] Cloud Run `min=0` / `max=1` / internal ingress
- [ ] Cloud Run手動復帰commandとCNAME rollback手順が記録済み
- [ ] app/develop-metaともremote equality `0 0`
- [ ] pending AR run、未監視deploy、対象worktree/branch残存なし
