---
status: accepted
date: 2026-05-23
---

# ADR-0004: callback dedupはin-memory Map・5分window

OpenSpec capability: [`callback-delivery`](../../openspec/specs/callback-delivery/spec.md)

## Context and Problem Statement

LINE WORKS Callbackの重複受信・再投入による副作用の二重実行を、外部ストアを必須にせず軽減したい。callback payloadには一意なevent IDがない。

## Decision Drivers

- 小規模な構成で追加インフラを要求しない
- 同一runtime内の短時間の重複イベントを除外する
- 転送失敗時には手動再投入等での再実行を受け入れられること

## Considered Options

- dedupを行わない
- raw bodyのhashをin-memoryで保持する
- 共有永続ストアでdedupする

## Decision Outcome

Chosen option: 「raw bodyのhashをin-memoryで保持する」

`callback/dedup.ts`でraw bodyのSHA-256をkeyに、直近5分windowの重複を検出する。転送に失敗した場合はkeyを解除 (`unregister`) し、手動再投入時等に再実行できるようにする。公式Callbackページで自動再送契約は確認できないため、これはLINE WORKSの自動再送を前提にした設計ではない。現行はCloud Run/Workers共通で同期await転送、失敗は500とログ、厳密な非消失はDurable Queueを将来TODOとする。

### Consequences

- Good: 外部依存なしで典型的な短時間重複を抑止できる
- Bad: Workersのisolate間やCloud Runのinstance間ではMapが共有されず、dedupはbest effortになる
- Neutral: 厳密な一回処理が必要な場合は、共有永続ストアまたはupstream側のidempotencyを追加する。非消失保証が必要な場合はDurable Queueを追加する

### Confirmation

dedup単体testとcallback route testで、重複skip、5分後の再受付、転送失敗時の解除を確認する。

<!-- Private legacy source SHA-256: 304365cc61b03ce93a470909945c11499f891cdb9ff86f5512b46ff71801e144 -->
<!-- Public sanitized record SHA-256: cf1e6a894248c71773af1edb76f69f7785d463dd00a914652b63735aeb28bbe0 -->

## Sanitized Original Record

~~~~markdown
callback payloadにevent IDがないため、raw bodyのSHA-256をkeyとする5分間のin-memory dedupを採用した。複数isolate / instance間では共有されない制約は当初からあり、厳密性が必要になった時点で共有storeへ移す方針とした。特定の転送先service名と実instance構成はprivate infra SoTへ移した。
~~~~
