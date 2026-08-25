## Why

OpenSpec導入時は既存仕様を一括backfillしない方針としたが、accepted ADRに残る現行contractまでcurrent specに存在しないため、Agentが変更影響を仕様から横断的に把握できない。既存ADRの判断理由を複製せず、テスト可能な現行contractだけを一度限りのcurated baselineとして追加する。

## What Changes

- ADR-0001〜0011を7つのcapabilityへ整理し、現行contractをcurrent specへ反映する
- ADRと対応するOpenSpec capabilityを双方向リンクする
- supersededのADR-0001は独立specを作らず、ADR-0010へ至る系譜として扱う
- 既存文書の無差別backfill禁止を維持しつつ、accepted ADRのcurated baselineを例外として明文化する
- ADRとOpenSpecの対応漏れをmachine testで検出し、CIで実行する
- 過去のOpenSpec導入archiveは履歴として変更しない

## Capabilities

### New Capabilities

- `dual-runtime-deployment`: Workers / Cloud Runの共通app、runtime境界、container・build制約
- `lineworks-jwt-authentication`: LINE WORKS server token用JWTの署名・audience・秘密鍵形式
- `callback-delivery`: callback検証後のdedupと設定可能なupstreamへの同期転送
- `public-http-authentication`: health / callbackを除く公開HTTP pathのBASIC認証境界
- `message-type-dispatch`: message schema mapと汎用dispatcherによるroute・payload生成
- `deployment-security`: 専用runtime service account、Secret Manager、公開repository向けsubstitution
- `adr-publication-integrity`: sanitized original recordとdigestによる公開ADRの完全性

### Modified Capabilities

- `change-specification-workflow`: accepted ADRの現行contractを一度限りのcurated baselineとしてbackfillし、ADRとの対応を同期する

## Impact

- `docs/adr/0001`〜`0011`とADR index
- `docs/conventions/documentation.md`
- `openspec/config.yaml`と8つのcurrent spec
- OpenSpec / ADR coverage testとCI
- `CHANGELOG.md`
- product runtimeと既存HTTP APIの挙動には影響しない
