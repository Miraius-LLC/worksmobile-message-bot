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

署名検証、dedup、Zod検証を通したcallbackを、raw bodyと`X-WORKS-Signature`を保ったまま`FORWARD_CALLBACK_URL`へ転送する。未設定の場合は転送せず`200`を返す。

### Consequences

- Good: gatewayを変更せずに転送先や業務ロジックを交換できる
- Good: ローカル開発ではupstreamを起動せずcallback受信だけを確認できる
- Bad: 転送先障害時の再送とidempotencyを両サービスで考慮する必要がある

### Confirmation

callback route testsでraw body、署名、成功時応答、失敗時のdedup解除を確認する。

## Sanitized Original Record

初期判断でも本サーバをLINE WORKS gatewayに限定し、署名検証、dedup、Zod検証後のraw bodyと署名を別serviceへ転送する方式を採用した。旧記録に含まれていた特定の転送先service名とURLは環境固有情報のためprivate infra SoTへ移し、公開APIを`FORWARD_CALLBACK_URL`へ一般化した。
