---
status: accepted
date: 2026-05-23
---

# ADR-0006: BASIC 認証を `/` と health probe / callback 以外に強制

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

Chosen option: 「BASIC 認証を `/` と health probe / callback 以外に強制」

移行前のADRに記録された判断を維持する。判断の詳細・理由・比較した選択肢は「Original Record」を正とする。

### Consequences

- Good: 移行前の記録を失わず、全ADRを同じ構造で検索・監査できる
- Bad: 移行済みADRには標準構造と移行前原文が併存する
- Neutral: この形式移行は既存の判断、status、相対リンクの意味を変更しない

### Confirmation

移行前原文のSHA-256を照合し、Git差分とproject横断ADR監査で欠落・改変がないことを確認する。

<!-- Legacy source SHA-256: 54f1780fdf3784da638e0e08718c97d331d14eaed5a5e852c65e8d88d2056eff -->

## Original Record

~~~~markdown
# BASIC 認証を `/` と health probe / callback 以外に強制

公開 webhook エンドポイントの保護に **BASIC 認証**（`hono/basic-auth`）を `app.use('*', ...)` で全体に掛け、`PUBLIC_PATHS` set で除外パスを管理する。除外は **`/` と health probe 系**（`/healthz` を正、`/health` / `/readyz` / `/livez` は互換エイリアスで同じハンドラを共有、`HEALTH_PATHS` 配列で集中管理）、および **`/callback`**（LINE WORKS は BASIC 認証ヘッダを喋らないため、代わりに `X-WORKS-Signature` の HMAC 検証で真正性を担保）。Cloud Run / k8s probe / Docker HEALTHCHECK が認証で落ちないようにする。`basicAuth` は config().load() タイミングを跨ぐため **lazy 初期化**。`app.onError` は `basicAuth` 等が投げる `HTTPException` を `getResponse()` で素通しし、500 で潰さない。

_出典: CLAUDE.md 注意点（よくあるハマり）/ README.md エンドポイント一覧の認証注記_
~~~~
