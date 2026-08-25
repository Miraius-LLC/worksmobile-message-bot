# deployment-security Specification

## Purpose

Cloud Runのruntime identity、Secret Manager注入、公開repository向けsubstitution境界を固定する。

## Requirements

### Requirement: 専用runtime service accountを使用する

Cloud Run serviceはdefault compute service accountではなく専用runtime service accountで実行し、そのservice accountへ必要最小限のSecret Manager参照権限だけを付与しなければならない（SHALL）。

Source ADR: [ADR-0009](../../../docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md)

#### Scenario: Runtime identityを構成する

- **WHEN** Cloud Run serviceをdeployする
- **THEN** deploy設定は専用runtime service accountを指定する

#### Scenario: Secret access権限を付与する

- **WHEN** runtimeがsecretを参照する必要がある
- **THEN** 対象service accountには必要なsecretへの`secretAccessor`だけを付与する

### Requirement: 機密値をSecret Managerから注入する

本番の機密値はSecret Managerのversion参照からruntimeへ注入し、Cloud Runの平文environment variableまたはtracked fileへ保存してはならない（MUST NOT）。

#### Scenario: Secretをdeploy設定へ追加する

- **WHEN** runtimeへ新しい機密値を渡す
- **THEN** deploy設定はSecret Manager referenceを使い、値そのものを含めない

#### Scenario: Secretを更新する

- **WHEN** `:latest`が参照するsecret versionを追加する
- **THEN** runtimeはtracked deploy設定へ秘密値を書き戻さず更新値を参照できる

### Requirement: 公開repositoryの環境値をsubstitutionで受け取る

公開repositoryの`cloudbuild.yaml`は機密値だけでなく環境固有の識別子もliteralとして固定せず、Cloud Build substitutionから受け取らなければならない（SHALL）。

#### Scenario: 環境固有値をdeployへ渡す

- **WHEN** Cloud Build triggerまたはmanual buildがdeployを実行する
- **THEN** yamlは定義済みsubstitution placeholderから値を取得する
