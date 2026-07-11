---
status: accepted
date: 2026-05-23
---

# ADR-0004: callback dedup は in-memory Map・5 分 window

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

<!-- Legacy source SHA-256: 304365cc61b03ce93a470909945c11499f891cdb9ff86f5512b46ff71801e144 -->

## Original Record

~~~~markdown
# callback dedup は in-memory Map・5 分 window

LINE WORKS の callback 再送による副作用二重実行を防ぐため、`callback/dedup.ts` で **raw body の SHA-256** を key にした in-memory Map で **直近 5 分 window** の重複を検出し、ヒットしたら skip して 200 を返す。callback payload には event ID 相当のフィールドが無いため payload 全体のハッシュを key にする。**Cloud Run の min-instances=1 前提**（複数 instance になると instance ごとに別 Map になり dedup が破綻する。`cloudbuild.yaml` で `--min-instances=1` を明示）。501 への転送（[ADR-0005](./0005-forward-callback-to-501.md)）が throw した場合は dedup key を `unregister` して LINE WORKS の再送を許可する（転送失敗 event の喪失防止）。

## 検討した代替
- **Redis 等の共有ストア**: 現規模（1 instance 張り付き）では過剰。max-instances を増やして 2 instance 目が立つ頻度が上がったら共有ストアへ移行する前提。

_出典: CLAUDE.md 注意点（よくあるハマり）/ README.md Callback（受信側）, commit 4254e35 / 4784cca_
~~~~
