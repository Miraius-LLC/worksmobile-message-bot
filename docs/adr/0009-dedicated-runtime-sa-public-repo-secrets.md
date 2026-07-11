---
status: accepted
date: 2026-05-23
---

# ADR-0009: 専用 runtime SA + 公開リポ向け secret 運用

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

<!-- Legacy source SHA-256: 97d544cc34302ae19b85e22b763bb5578db0a65bdc391c320df8f548b4a7456a -->

## Original Record

~~~~markdown
# 専用 runtime SA + 公開リポ向け secret 運用

Cloud Run の runtime SA は **専用 SA**（`worksmobile-message-bot-sa`）を使い、デフォルトの compute SA は使わない（権限分離）。SA は必要な secret の `secretAccessor` ロールのみを持つ。機密 env（client secret / private key / BASIC 認証 / bot secret 等）は Cloud Run の env に直書きせず **Secret Manager** に置き、`:latest` を参照する設定（`--update-secrets=...`）にして、再 deploy 不要で値だけ差し替えられるようにする。

このリポは **公開**なので、機密度の低い env も含め **値自体を `cloudbuild.yaml` に書かない**。GCP Console の Cloud Build トリガー設定の substitution variable に値を入れ、yaml 側はプレースホルダ参照（`${_...}`）のみにする。

_出典: CLAUDE.md 注意点（Docker / デプロイ）/ README.md デプロイ・Secret のローテーション_
~~~~
