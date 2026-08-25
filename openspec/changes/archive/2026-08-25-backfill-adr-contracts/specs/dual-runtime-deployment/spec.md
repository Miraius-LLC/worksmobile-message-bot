## ADDED Requirements

### Requirement: 共通Hono appをWorkersとCloud Runから起動する

worksmobile-message-botはruntime非依存のHono appを`src/app.ts`に保持し、Cloudflare Workers用entrypointとCloud Run用entrypointから同じappを起動しなければならない（SHALL）。

Source ADRs: [ADR-0001](../../../../../docs/adr/0001-cloud-run-hono-bun.md)、[ADR-0002](../../../../../docs/adr/0002-container-http1-only-no-h2c.md)、[ADR-0008](../../../../../docs/adr/0008-docker-cloud-build-constraints.md)、[ADR-0010](../../../../../docs/adr/0010-dual-cloud-deployment.md)

#### Scenario: Workersで起動する

- **WHEN** Workers runtimeが`src/worker.ts`を読み込む
- **THEN** entrypointは共通Hono appをfetch handlerとして公開する

#### Scenario: Cloud Runで起動する

- **WHEN** Bun runtimeが`src/index.ts`を実行する
- **THEN** entrypointは共通Hono appをHTTP serverへ接続し、graceful shutdownを提供する

### Requirement: Container内部はHTTP/1.1だけを使用する

Cloud Run containerはHTTP/1.1でlistenしなければならず（SHALL）、end-to-end h2cまたは`--use-http2`を有効化してはならない（MUST NOT）。公開側のHTTP/2終端はCloud Run frontendへ委ねる。

#### Scenario: Cloud Runへdeployする

- **WHEN** deploy設定を生成または変更する
- **THEN** containerはHTTP/1.1のままで、h2cを要求する設定を含まない

### Requirement: Portableなmulti-stage container imageを構築する

container imageはBun Debian builderとBun slim runtimeのmulti-stage buildを使用し、BuildKit専用構文へ依存せず、非rootの`bun` userでbundleを直接実行しなければならない（SHALL）。

#### Scenario: Runtime imageをbuildする

- **WHEN** Dockerfileからproduction imageをbuildする
- **THEN** runtime stageにはbundleと実行に必要な最小構成だけが入り、`USER bun`で`bun build/index.js`を起動する

#### Scenario: Healthcheckを実行する

- **WHEN** container healthcheckが`/healthz`を確認する
- **THEN** imageへcurlを追加せずBunのfetchを使用する

### Requirement: RuntimeとtoolchainのBun versionを同期する

Dockerfileのbuilder/runtime base imageで固定するBun versionは`.tool-versions`と一致しなければならない（SHALL）。

#### Scenario: Bun versionを更新する

- **WHEN** Dockerfileまたは`.tool-versions`のBun versionを変更する
- **THEN** すべての固定versionを同じ値へ更新する

### Requirement: Cloud Build設定をCloud Run deployのSoTとする

Cloud Runのservice account、secret mount、scaling、resource、HTTP protocol、labelに関するdeploy設定は`cloudbuild.yaml`をSoTとしなければならない（SHALL）。

#### Scenario: Cloud Run deploy条件を変更する

- **WHEN** deploy時のruntime条件を変更する
- **THEN** `cloudbuild.yaml`へ反映し、別の隠れたdeploy commandへ同じ設定を分散させない

### Requirement: Supersededな単一runtime判断を現行contractにしない

ADR-0001のCloud Run単一runtime判断はADR-0010によりsupersedeされており、独立したcurrent capabilityとして復活させてはならない（MUST NOT）。

#### Scenario: ADR-0001を仕様から参照する

- **WHEN** runtime選定の系譜を確認する
- **THEN** 本capabilityからADR-0001とADR-0010の両方を辿れ、現行contractはdual-runtimeとして読める
