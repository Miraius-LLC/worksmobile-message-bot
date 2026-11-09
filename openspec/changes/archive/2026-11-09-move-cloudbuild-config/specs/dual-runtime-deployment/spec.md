## MODIFIED Requirements

### Requirement: Cloud Build設定をCloud Run deployのSoTとする

Cloud Runのservice account、secret mount、scaling、resource、HTTP protocol、labelに関するdeploy設定は`.config/cloudbuild.yaml`をSoTとしなければならない（SHALL）。

#### Scenario: Cloud Run deploy条件を変更する

- **WHEN** deploy時のruntime条件を変更する
- **THEN** `.config/cloudbuild.yaml`へ反映し、別の隠れたdeploy commandへ同じ設定を分散させない
