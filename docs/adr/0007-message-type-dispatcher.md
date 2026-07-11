---
status: accepted
date: 2026-05-23
---

# ADR-0007: メッセージ型 dispatcher（個別 sender なし）

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

Chosen option: 「メッセージ型 dispatcher（個別 sender なし）」

移行前のADRに記録された判断を維持する。判断の詳細・理由・比較した選択肢は「Original Record」を正とする。

### Consequences

- Good: 移行前の記録を失わず、全ADRを同じ構造で検索・監査できる
- Bad: 移行済みADRには標準構造と移行前原文が併存する
- Neutral: この形式移行は既存の判断、status、相対リンクの意味を変更しない

### Confirmation

移行前原文のSHA-256を照合し、Git差分とproject横断ADR監査で欠落・改変がないことを確認する。

<!-- Legacy source SHA-256: 9b70ebf62ee77e23bb6733f0f061730275258393d94f9aa0e8f8f3b9676632f4 -->

## Original Record

~~~~markdown
# メッセージ型 dispatcher（個別 sender なし）

メッセージ送信は **型ごとの個別 sender 関数を書かず**、`services/lineworks/messages/index.ts` の `messageSchemas` マップ（type → Zod schema）+ 汎用 `sendMessageByType` で処理する。`sendMessageByType` は検証済み body を `{ type, ...body }` の wire format に組み立てて POST する。`routes/messages.ts` のループがこのマップを走査し、両 base（channels / users）× 全 type を `(channels|users)/:id/messages/type/<type>` として自動登録する。新しいメッセージ型は **schema を 1 件足すだけ**でルート登録・送信が通る（boilerplate の重複を避ける）。LINE WORKS の wire format に揃わない型だけ schema 側で `.transform()` する。

_出典: CLAUDE.md 注意点（命名・配置）/ services.md messages, routes.md メッセージ系エンドポイント_
~~~~
