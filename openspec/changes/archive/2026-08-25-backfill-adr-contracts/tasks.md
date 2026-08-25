# ADR OpenSpec Backfill Implementation Plan

> **For Codex:** Execute this plan one vertical slice at a time. Confirm RED before the matching documentation/spec change, then run the listed focused verification. Do not edit protected ADR records or the archived `adopt-openspec` change.

**Goal:** accepted ADRに残る現行contractを7つのOpenSpec capabilityへbackfillし、ADRとの双方向対応を継続的に検証できるようにする。

**Architecture:** ADRは判断理由・選択肢・trade-offのSoTとして維持し、OpenSpecはテスト可能な現行contractだけを保持する。固定mappingを使うcoverage testで11 ADRの完全被覆、双方向リンク、superseded ADRの扱いを検証する。

**Tech Stack:** Bun、TypeScript、OpenSpec 1.10.0、GitHub Actions、Markdown

---

## 1. Coverage contractをREDにする

- [x] 1.1 `openspec-adr-coverage.test.ts`を追加し、ADR-0001〜0011を7 capabilityへ対応付ける固定fixtureを定義する
- [x] 1.2 各ADRが期待するcurrent specへリンクし、各specがsource ADRへリンクすることを検証する
- [x] 1.3 ADR-0001に独立current specがなく、`dual-runtime-deployment`へだけ対応することを検証する
- [x] 1.4 `bun test openspec-adr-coverage.test.ts`を実行し、未作成のcurrent specまたはリンクにより失敗することを確認する

実装fixtureの形:

```ts
const adrCapabilities = {
  "0001-cloud-run-hono-bun.md": ["dual-runtime-deployment"],
  "0002-container-http1-only-no-h2c.md": ["dual-runtime-deployment"],
  "0003-jwt-node-crypto-rs256.md": ["lineworks-jwt-authentication"],
  "0004-callback-dedup-in-memory-5min.md": ["callback-delivery"],
  "0005-forward-callback-to-upstream.md": ["callback-delivery"],
  "0006-basic-auth-except-health-and-callback.md": ["public-http-authentication"],
  "0007-message-type-dispatcher.md": ["message-type-dispatch"],
  "0008-docker-cloud-build-constraints.md": ["dual-runtime-deployment"],
  "0009-dedicated-runtime-sa-public-repo-secrets.md": ["deployment-security"],
  "0010-dual-cloud-deployment.md": ["dual-runtime-deployment"],
  "0011-sanitized-original-record-for-public-repository.md": ["adr-publication-integrity"],
} as const;
```

## 2. ADRと文書policyを同期する

- [x] 2.1 `docs/adr/0001`〜`0011`のprotected record外へ、対応する`../../openspec/specs/<capability>/spec.md`リンクを追加する
- [x] 2.2 `docs/adr/README.md`へADR / OpenSpecの責務分界とcapability対応を追加する
- [x] 2.3 `docs/conventions/documentation.md`と`openspec/config.yaml`を、accepted ADRの一度限りのcurated baselineと将来のdelta-only運用へ更新する
- [x] 2.4 focused testを再実行し、ADR側リンク検証が通り、current spec未作成だけが残ることを確認する

## 3. Curated baselineをarchiveしてcurrent specへ反映する

- [x] 3.1 7つのADDED delta specへADR由来のテスト可能な要求とscenarioを書く
- [x] 3.2 `change-specification-workflow`のMODIFIED deltaへ限定backfill例外と双方向同期要件を書く
- [x] 3.3 `bun run spec:validate`でactive changeをstrict validationする
- [x] 3.4 1〜3の完了項目を更新し、`bun run spec -- archive backfill-adr-contracts --yes`でdeltaをcurrent specへ反映する
- [x] 3.5 `bun test openspec-adr-coverage.test.ts`と`bun run spec:validate`を実行し、7 capabilityとworkflow specが通ることを確認する

## 4. Repository verificationとcloseout

- [x] 4.1 coverage testを`.github/workflows/ci.yml`のBiome対象とtest jobへ追加する
- [x] 4.2 `CHANGELOG.md`へcurated baselineとcoverage guardを記録する
- [x] 4.3 `bun test`、`bunx tsc --noEmit`、`bunx biome check`、`bun run build`、`bun run spec:validate`を実行する
- [x] 4.4 Standards / Specの2軸reviewを行い、必要な修正後に同じ検証を再実行する
- [x] 4.5 archived tasksを完了状態へ更新し、差分、未追跡file、過去archive不変を確認してcommitする
