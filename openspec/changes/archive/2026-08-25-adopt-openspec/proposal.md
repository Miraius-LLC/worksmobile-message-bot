## Why

API contractや認証境界の変更要求と実装方針を、会話や一過性の計画から切り離してAgent間で追跡可能にする。既存のADR、AGENTS、README、CONTEXT、テストの責務は維持する。

## What Changes

- OpenSpec 1.10.0をrepository-localな開発依存として固定する
- contract変更へOpenSpecを適用し、挙動不変の保守変更は対象外とする
- local、pre-push、CIで同じstrict validationを実行する
- 既存仕様はbackfillせず、導入後のdelta specだけを段階的に蓄積する
- Graphify / CodeGraphは既存運用を維持し、CodeGraphのportable exclude設定を補う

## Capabilities

### New Capabilities

- `change-specification-workflow`: contract変更の提案、実装、検証、archiveに関する適用境界とSoT分界

### Modified Capabilities

なし。

## Impact

- root開発依存とpackage scripts
- `openspec/`配下のproject config、current spec、archive
- `AGENTS.md`と文書運用規約
- pre-pushとCIのstrict validation
- CodeGraphのtracked exclude設定
- product runtimeと既存HTTP APIには影響しない
