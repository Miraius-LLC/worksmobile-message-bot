---
status: superseded by ADR-0010
date: 2026-05-11
---

# ADR-0001: webhookサーバをCloud Run + Hono + Bunで実行する

## Context and Problem Statement

Webhookサーバをコンテナとして運用しながら、Web標準のRequest / Responseを使うアプリケーション構造を維持したい。

## Decision Drivers

- managed container runtimeで運用負荷を抑える
- TypeScriptのruntime、package manager、bundler、test runnerをBunへ統一する
- graceful shutdownを含むNode server entrypointを明示する

## Considered Options

- VM上の常駐process
- Cloud Run + Hono + Bun
- edge runtime専用実装

## Decision Outcome

Chosen option: 「Cloud Run + Hono + Bun」

`@hono/node-server`の`serve()`でlistenし、SIGTERM時にgraceful shutdownする。HonoのWeb標準APIを使い、アプリケーションロジックを実行基盤から分離する。

この決定は、Cloud Runだけに限定せずWorkersと共通appを利用するADR-0010で拡張された。

### Consequences

- Good: DockerとCloud Buildでmanaged containerへデプロイできる
- Good: Hono appを別runtimeでも再利用しやすい
- Bad: コンテナ固有entrypointとhealth checkを保守する必要がある

### Confirmation

Docker build、Cloud Build設定の契約テスト、共通app testで確認する。

## Sanitized Original Record

初期実装ではWebhookサーバの実行先としてCloud Runを採用し、Hono on Bunと`@hono/node-server`を利用した。HonoがWeb標準Request / Responseで動くため、将来edge runtimeへ展開できることも判断理由だった。固定regionや実instance構成は設計判断ではなく環境固有の運用情報であるため、公開記録から除外してprivate infra SoTで管理する。
