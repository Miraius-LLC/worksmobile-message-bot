## Context

Cloud Runは休止中で、再開時にtriggerを作成する。現行の設定内容は維持し、追跡対象ファイルだけを移動する。現行specの2 capabilityが旧pathを規範文に含む。

## Decision

`cloudbuild.yaml`を`.config/cloudbuild.yaml`へrenameし、manual buildの`--config`とtriggerの`filename`を新pathにする。関連するテストと現行手順書の参照を更新する。specはMODIFIED deltaをarchiveして更新し、ADRのOriginal Recordは変更しない。

## Rollback

設定をrootに戻し、manual build・trigger・テスト・現行specのpathを戻す。
