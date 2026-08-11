---
status: accepted
date: 2026-08-10
---

# ADR-0010: WorkersとCloud Runの両方へデプロイ可能にする

## Context and Problem Statement

同じLINE WORKS Webhookアプリケーションを、エッジruntimeとコンテナruntimeのどちらでも運用できるようにしたい。

## Decision Drivers

- 利用者が要件に合う実行基盤を選べること
- アプリケーションロジックを基盤固有コードから分離すること
- 両方のデプロイ経路を継続的に検証できること

## Considered Options

- Cloudflare Workersだけをサポートする
- Cloud Runだけをサポートする
- 共通Hono appを両runtime用entrypointから利用する

## Decision Outcome

Chosen option: 「共通Hono appを両runtime用entrypointから利用する」

`src/app.ts`を共通化し、Workersは`src/worker.ts`、Cloud Runは`src/index.ts`から起動する。WorkersはWranglerとGitHub Actions、Cloud RunはDockerとCloud Buildを独立したデプロイ経路として維持する。

### Consequences

- Good: 基盤を選択してもrouteとserviceの実装を共有できる
- Good: 一方の基盤に依存せずデプロイできる
- Bad: 両runtimeの互換性と設定をCIで維持する必要がある
- Neutral: 実行基盤の主従や環境固有の切替情報は、公開ADRではなくprivate infra SoTで管理する

### Confirmation

共通test suite、Workers dry-run、Docker/Cloud Build設定の契約テストで両経路を確認する。

## Sanitized Original Record

Workers対応の導入時に、共通Hono appを維持しながらWorkersとCloud Runの両deploy資産を残すことを決定した。旧記録に含まれていた一時的な主従構成、実domain、resource ID、切替証跡、rollback手順は製品設計ではなく環境固有の運用情報であるためprivate infra SoTへ移した。
