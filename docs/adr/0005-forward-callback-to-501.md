---
status: accepted
date: 2026-05-23
---

# ADR-0005: callback を 501 に転送する（案 B）

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

<!-- Legacy source SHA-256: 7877bd11d775071d9bf515378930ce0489be8fd57e5f6f46cfa39536ba9bdf3c -->

## Original Record

~~~~markdown
# callback を 501 に転送する（案 B）

本サーバは LINE WORKS の **gateway** として callback を受信し、署名検証 → dedup → Zod 検証を通したら、raw body + `X-WORKS-Signature` を env `FORWARD_501_CALLBACK_URL`（= scheduler-501 の `/callback`）へ **そのまま素通し転送**する（`callback/forward.ts`、未設定なら転送せず skip）。応答コマンド（`/today` `/status` 等）の handler は **501 側**にある。Google Calendar / scheduler 等のドメインが必要な処理を 501 に集約し、本サーバは LINE WORKS との接続・検証・転送だけに責務を絞るため。

本サーバ内の `callback/{dispatch,handlers,reply}.ts` のローカル handler 雛形は二重応答を避けるため**呼ばれない**（削除はせず雛形として残置）。応答コマンドの追加は 501 側で行う。

## 検討した代替
- **本サーバ内でローカル応答（雛形 handler を使う）**: 501 と二重応答になり、ドメインロジックが 2 リポに分散する。転送 1 本に統一した。

_出典: CLAUDE.md 注意点（よくあるハマり）/ README.md 応答コマンド, commit 88cdc90 / 2fee811_
~~~~
