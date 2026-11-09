## Why

Cloud Buildの設定を`.config/`へ移してrepository rootのファイル数を減らす。現行仕様が旧pathを規範として参照しているため、配置変更を仕様に反映する。

## What Changes

- Cloud Build設定を`.config/cloudbuild.yaml`へ移す
- manual buildとtriggerの設定path、手順書、テストを新pathへ揃える
- Cloud Buildのdeploy条件とsubstitutionの契約は維持する

## Capabilities

### Modified Capabilities

- `deployment-security`: 公開repositoryのCloud Build設定pathを更新する
- `dual-runtime-deployment`: Cloud Run deploy設定のSoT pathを更新する

## Impact

- Cloud Run再開時のmanual buildとtrigger設定は新pathを指定する
- Cloud Runへのdeployや外部resourceの変更は行わない
