---
status: accepted
date: 2026-05-23
---

# ADR-0003: JWT は node:crypto で自前生成（RS256）

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

Chosen option: 「JWT は node:crypto で自前生成（RS256）」

移行前のADRに記録された判断を維持する。判断の詳細・理由・比較した選択肢は「Original Record」を正とする。

### Consequences

- Good: 移行前の記録を失わず、全ADRを同じ構造で検索・監査できる
- Bad: 移行済みADRには標準構造と移行前原文が併存する
- Neutral: この形式移行は既存の判断、status、相対リンクの意味を変更しない

### Confirmation

移行前原文のSHA-256を照合し、Git差分とproject横断ADR監査で欠落・改変がないことを確認する。

<!-- Legacy source SHA-256: 519613279c61e8ec98b469a07c3885fefec7a112eeab61910c6d7fd1a4f983f7 -->

## Original Record

~~~~markdown
# JWT は node:crypto で自前生成（RS256）

LINE WORKS OAuth 用の JWT は **`node:crypto` の `createSign('RSA-SHA256')` で自前生成**する（`jsonwebtoken` パッケージは撤去済）。`aud` は LINE WORKS の OAuth トークンエンドポイント（`https://auth.worksmobile.com/oauth2/v2.0/token`）に固定し、`auth.ts` の `AUTH_URL` 定数と一致させる。署名鍵 `PRIVATE_KEY` は **Base64 エンコード済 PEM** を前提に `getPrivateKey` でデコードして使う（生 PEM を直接渡すと署名失敗、config の Zod schema が起動時に PEM 含有チェック）。

## 検討した代替
- **jsonwebtoken パッケージ**: RS256 署名は `node:crypto` だけで足りるため、依存削減目的で撤去した。

_出典: CLAUDE.md 注意点（MUST）/ services.md auth_
~~~~
