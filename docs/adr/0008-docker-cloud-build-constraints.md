---
status: accepted
date: 2026-05-23
---

# ADR-0008: Docker / Cloud Build の制約

## Context and Problem Statement

このADRは共通テンプレート導入前に作成された。移行前の判断記録は末尾の「Original Record」に内容を変更せず保存する。

## Decision Drivers

- 移行前の判断内容と履歴を変更しない
- 全ADRを共通のfitness functionで監査可能にする

## Considered Options

- 既存ADRをlegacyとして監査対象外のまま維持する
- 原文を現在形で要約し直す
- 原文を完全保存したまま標準構造を付加する

## Decision Outcome

Chosen option: 「原文を完全保存したまま標準構造を付加する」

移行前のADRに記録された判断を維持する。判断の詳細・理由・比較した選択肢は「Original Record」を正とする。

### Consequences

- Good: 移行前の記録を失わず、全ADRを同じ構造で検索・監査できる
- Bad: 移行済みADRには標準構造と移行前原文が併存する
- Neutral: この形式移行は既存の判断、status、相対リンクの意味を変更しない

### Confirmation

移行前原文のSHA-256を照合し、Git差分とproject横断ADR監査で欠落・改変がないことを確認する。

<!-- Legacy source SHA-256: fd0416a814a2b4b29723aedb7ac6711851b87c446bcf24748fda228c2446de7b -->

## Original Record

~~~~markdown
# Docker / Cloud Build の制約

イメージは **マルチステージビルド**で、builder（`oven/bun:<ver>-debian`）で `bun install` + `bun run build` し、runtime（`oven/bun:<ver>-slim`）には `build/index.js` だけを COPY する（`node_modules` / `tsconfig.json` / `package.json` は runtime に残さない）。**BuildKit 限定構文は使わない**（Cloud Build 既定の `gcr.io/cloud-builders/docker` が BuildKit 非対応のため `--mount=type=cache` / `--mount=type=secret` は禁止、普通のレイヤキャッシュで代替）。**非 root で起動**（`USER bun`、COPY は `--chown=bun:bun`）。HEALTHCHECK は **curl を入れず `bun -e "fetch(...)"`** で `/healthz` を叩く。build / deploy パイプラインは **`cloudbuild.yaml` が SoT**（trigger に inline build を残さず、SA / secrets / scaling / resources / `--no-use-http2` / labels をすべてここで管理し、手動 `gcloud run services update` での drift を防ぐ）。bun のバージョンは Dockerfile の `FROM` 2 行で固定し `.tool-versions` と一致させる。

_出典: CLAUDE.md 注意点（Docker / デプロイ）/ README.md デプロイ_
~~~~
