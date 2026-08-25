# OpenSpec Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OpenSpecをrepository-localに導入し、仕様変更をstrict validation付きで管理できるようにする。

**Architecture:** OpenSpecは開発依存とtracked Markdown artifactだけで構成し、product runtimeから分離する。package scriptをlocal・Lefthook・CIの共通入口にし、適用境界とSoT分界を初期capabilityとしてarchiveする。既存Graphify / CodeGraph設定は変更せず、同等性をcontract testと最終監査で確認する。

**Tech Stack:** Bun 1.4.0、TypeScript、bun:test、OpenSpec 1.10.0、Lefthook、GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-25-openspec-adoption-design.md`

## Global Constraints

- `@fission-ai/openspec`は`1.10.0`のexact devDependencyとする。
- telemetryは全repository scriptで`OPENSPEC_TELEMETRY=0`にする。
- strict validationは`openspec validate --all --strict --no-interactive`とする。
- 既存仕様はbackfillせず、導入後のdelta specだけを蓄積する。
- Graphify / CodeGraphの既存設定とlocal-cache境界を変更しない。
- product runtime、HTTP endpoint、LINE WORKS連携の挙動を変更しない。

---

### Task 1: Repository contractをテストで固定する

**Files:**
- Create: `openspec-config.test.ts`
- Modify: `package.json`
- Modify: `bun.lock`

**Interfaces:**
- Consumes: 既存のroot-level config contract testパターン
- Produces: `bun run spec -- <command>`、`bun run spec:validate`、exact devDependency `@fission-ai/openspec@1.10.0`

- [ ] **Step 1: 失敗するrepository contract testを書く**

  `package.json`を読み、OpenSpecのexact version、telemetry無効のscripts、LefthookとCI内の`spec:validate`参照、既存`.mcp.json`とGraphify hookを検証する。

- [ ] **Step 2: REDを確認する**

  Run: `bun test openspec-config.test.ts`

  Expected: OpenSpec dependencyまたはscriptsが未定義でFAILする。

- [ ] **Step 3: OpenSpec dependencyとscriptsを追加する**

  Run: `bun add --dev --exact @fission-ai/openspec@1.10.0`

  `package.json`へ次を追加する。

  ```json
  "spec": "OPENSPEC_TELEMETRY=0 openspec",
  "spec:validate": "OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive"
  ```

- [ ] **Step 4: dependency部分のcontractが通ることを確認する**

  Run: `bun test openspec-config.test.ts`

  Expected: hookとCIの未接続だけがFAILする。

### Task 2: OpenSpec projectと初期capabilityを作る

**Files:**
- Create: `openspec/config.yaml`
- Create: `openspec/specs/change-specification-workflow/spec.md`
- Create: `openspec/changes/archive/2026-08-25-adopt-openspec/.openspec.yaml`
- Create: `openspec/changes/archive/2026-08-25-adopt-openspec/README.md`
- Create: `openspec/changes/archive/2026-08-25-adopt-openspec/proposal.md`
- Create: `openspec/changes/archive/2026-08-25-adopt-openspec/design.md`
- Create: `openspec/changes/archive/2026-08-25-adopt-openspec/tasks.md`
- Create: `openspec/changes/archive/2026-08-25-adopt-openspec/specs/change-specification-workflow/spec.md`

**Interfaces:**
- Consumes: Task 1の`bun run spec:validate`
- Produces: `change-specification-workflow` current specと導入履歴

- [ ] **Step 1: Bot向けconfigを書く**

  `schema: spec-driven`とし、既存SoTを置き換えないこと、API contract・validation・状態・認証境界へ適用すること、tasksを縦スライスにすることをrulesへ記載する。

- [ ] **Step 2: 初期workflow specとarchive artifactを書く**

  適用対象、対象外、SoT分界、strict validation、段階蓄積をSHALL / MUST NOTとWHEN / THEN scenarioで固定する。

- [ ] **Step 3: strict validationを実行する**

  Run: `bun run spec:validate`

  Expected: 全current specとarchive artifactがvalidになる。

### Task 3: Agent規約と検証経路を接続する

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/conventions/documentation.md`
- Modify: `lefthook.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `CHANGELOG.md`
- Modify: `openspec-config.test.ts`

**Interfaces:**
- Consumes: Task 1の`spec:validate` script、Task 2のartifact分界
- Produces: local / pre-push / CIで共通のOpenSpec validationとAgent向け適用規約

- [ ] **Step 1: contract testをhook・CI・文書まで完成させる**

  Lefthookのpre-pushに`spec:validate`があり、CI check jobに`bun run spec:validate`があり、`AGENTS.md`が詳細規約へ参照することを検証する。

- [ ] **Step 2: REDを確認する**

  Run: `bun test openspec-config.test.ts`

  Expected: pre-push、CI、文書規約が未接続でFAILする。

- [ ] **Step 3: 規約と検証経路を最小実装する**

  `docs/conventions/documentation.md`を詳細SoTとし、`AGENTS.md`には適用基準と導線だけを書く。LefthookとCIは同じ`bun run spec:validate`を呼ぶ。CHANGELOGにはOpenSpec導入と既存Graphify / CodeGraphの同等性確認を短く記録する。

- [ ] **Step 4: GREENを確認する**

  Run: `bun test openspec-config.test.ts && bun run spec:validate`

  Expected: PASSし、strict validationも成功する。

### Task 4: 全体検証とreview

**Files:**
- Modify: 必要な場合のみTask 1〜3の対象ファイル

**Interfaces:**
- Consumes: 全導入artifactと検証経路
- Produces: merge可能なOpenSpec導入コミット

- [ ] **Step 1: formatterを実行する**

  Run: `bunx biome check --write ./src ./tests ./scripts openspec-config.test.ts`

  Expected: 対象コードがformat済みになる。

- [ ] **Step 2: 全検証を実行する**

  Run: `bun run spec:validate`

  Run: `bun test`

  Run: `bunx tsc --noEmit`

  Run: `bunx biome check ./src ./tests ./scripts openspec-config.test.ts`

  Run: `bun run build`

  Run: `git diff --check`

  Expected: すべて成功する。

- [ ] **Step 3: Graphify / CodeGraph境界を監査する**

  `.mcp.json`、`.graphifyignore`、`.codegraph/.gitignore`、`.gitignore`、Lefthookのpost-merge / post-rebaseをAsunaroと照合し、生成物がtrackedされていないことを確認する。

- [ ] **Step 4: commitする**

  Run: `git add AGENTS.md CHANGELOG.md package.json bun.lock lefthook.yml .github/workflows/ci.yml docs/conventions/documentation.md docs/superpowers openspec openspec-config.test.ts`

  Run: `git commit -m "➕ OpenSpecの仕様管理基盤を導入"`

  Expected: pre-commitが成功し、worktreeがcleanになる。
