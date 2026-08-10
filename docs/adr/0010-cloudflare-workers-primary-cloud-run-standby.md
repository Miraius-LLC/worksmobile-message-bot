---
status: accepted
date: 2026-08-10
---

# ADR-0010: Cloudflare Workersを主系、Cloud Runを待機系とする

## Context and Problem Statement

Cloud Runの常時1 instance構成を、同じHono appを実行できるCloudflare Workersへ移し、通常deployとidle costを簡素化する。一方、LINE WORKS gatewayの障害時にCloud Runへ短時間で戻せる経路は維持する。

## Decision Drivers

- `main` pushから本番へ一貫してdeployできること
- `line-works.api.miraius.co.jp`を変更しないこと
- Cloud Runのidle compute costを止めること
- Workers障害時に既存Cloud Run serviceへ戻せること
- runtime固有entrypoint以外のapp実装を共有すること

## Considered Options

- Workersを主系、Cloud Runをscale-to-zeroの待機系にする
- Cloud Run serviceを削除し、コードだけ残す
- WorkersとCloud Runを毎回同時deployする

## Decision Outcome

Chosen option: 「Workersを主系、Cloud Runをscale-to-zeroの待機系にする」

### Consequences

- Good: 通常deployがGitHub Actions→Workersへ一本化され、Cloud Runのidle compute costを止められる
- Bad: Worker isolate間でin-memory dedupを共有できず、501側dedupへ最終防衛を依存する
- Neutral: Cloud Run用Docker/Cloud Build/Secret Manager/Artifact Registryはrollback資産として残る

### Confirmation

`wrangler-config.test.ts`と`ci-config.test.ts`でCustom Domainとdeploy gateを固定し、切替時はWorkers deployment、DNS/TLS、`/healthz`、BASIC認証、501 callback、Cloud Run scaling/ingress、Cloud Build trigger disabledを実測する。
