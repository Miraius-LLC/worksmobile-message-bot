## MODIFIED Requirements

### Requirement: 公開repositoryの環境値をsubstitutionで受け取る

公開repositoryの`.config/cloudbuild.yaml`は機密値だけでなく環境固有の識別子もliteralとして固定せず、Cloud Build substitutionから受け取らなければならない（SHALL）。

#### Scenario: 環境固有値をdeployへ渡す

- **WHEN** Cloud Build triggerまたはmanual buildがdeployを実行する
- **THEN** yamlは定義済みsubstitution placeholderから値を取得する
