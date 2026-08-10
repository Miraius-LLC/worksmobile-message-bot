---
status: superseded by ADR-0010
date: 2026-05-11
---

# ADR-0001: webhook サーバは Cloud Run + Hono + Bun

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

<!-- Legacy source SHA-256: 8838ce1e23352f193b3c28dae28fae85b023244d488c30035eac11555289c04d -->

## Original Record

~~~~markdown
# webhook サーバは Cloud Run + Hono + Bun

Develop 標準として、cron / 常駐 / webhook 系のサーバは **Google Cloud Run**（asia-northeast1）にデプロイする。HTTP は **Hono on Bun**、`@hono/node-server` の `serve()` で listen し、SIGTERM を受けたら graceful shutdown する。Hono は Web 標準 Request/Response で動くため Cloud Run でも edge でも同じコードが通り、Bun を runtime + パッケージマネージャ + バンドラ + test runner として一本化できる。

IFTTT / Make 等のノーコードツールから Webhook 経由で LINE WORKS Bot を叩く薄いラッパという用途に、常時 1 インスタンス張り付き（[ADR-0004](./0004-callback-dedup-in-memory-5min.md) の min-instances=1 前提）の Cloud Run が噛み合う。

_出典: README.md 技術スタック / デプロイ, CLAUDE.md アーキテクチャ_
~~~~
