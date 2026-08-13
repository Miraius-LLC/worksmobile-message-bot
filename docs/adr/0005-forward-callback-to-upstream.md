---
status: accepted
date: 2026-05-23
---

# ADR-0005: callbackを設定可能なupstreamへ転送する

## Context and Problem Statement

LINE WORKS callbackの認証とpayload検証は本サーバで行い、業務固有の応答処理は別サービスへ委譲できるようにしたい。

## Decision Drivers

- LINE WORKS gatewayと業務ロジックの責務を分離する
- raw bodyと署名を転送先でも利用できるようにする
- 転送先を特定のサービス名や基盤へ固定しない

## Considered Options

- 本サーバ内で応答処理まで行う
- 固定された別サービスへ転送する
- 環境変数で指定したupstreamへ転送する

## Decision Outcome

Chosen option: 「環境変数で指定したupstreamへ転送する」

署名検証、Bot ID検証 (`X-WORKS-BotId`)、dedup、JSON/Zod検証を通したcallbackを、raw bodyと`X-WORKS-Signature`を保ったまま`FORWARD_CALLBACK_URL`へ同期 await 転送する。未設定の場合は転送せず`200`を返す。転送失敗時はログを記録して`500`を返し、dedup keyを解除 (`unregister`) する。公式Callbackページで自動再送契約は確認できないため、`unregister` は手動再投入用である。

### Consequences

- Good: gatewayを変更せずに転送先や業務ロジックを交換できる
- Good: ローカル開発ではupstreamを起動せずcallback受信だけを確認できる
- Bad: 転送先障害時の厳密な非消失保証には Durable Queue が必要であり、現行の `500` とログは自動再送を保証しない。`unregister` により手動再投入は受け入れられる
- Neutral: 業務固有の処理は転送先の責務として扱い、本サーバはgatewayの責務を維持する

### Confirmation

callback route testsでraw body、署名、Bot ID、成功時応答、失敗時のdedup解除を確認する。

<!-- Private legacy source SHA-256: 7877bd11d775071d9bf515378930ce0489be8fd57e5f6f46cfa39536ba9bdf3c -->
<!-- Public sanitized record SHA-256: 97ff8a9f3bd8b0352627537eb63a65fbc0e12ec4af2b85e5a9e6f7fc5bfd9502 -->

## Sanitized Original Record

~~~~markdown
初期判断でも本サーバをLINE WORKS gatewayに限定し、署名検証、dedup、Zod検証後のraw bodyと署名を別serviceへ転送する方式を採用した。旧記録に含まれていた特定の転送先service名とURLは環境固有情報のためprivate infra SoTへ移し、公開APIを`FORWARD_CALLBACK_URL`へ一般化した。
~~~~
