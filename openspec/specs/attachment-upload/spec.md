# attachment-upload Specification

## Purpose
添付uploadでupload先へのfetchがtimeoutや通信例外で失敗したときの応答境界を固定する。署名付きupload URLや元例外の内容を、500応答の本文とログのどちらにも出さない。

## Requirements

### Requirement: Upload先の通信例外から署名URLを保護する

添付upload先へのfetchがtimeoutまたは通信例外で失敗した場合、endpointは500と固定error「ファイルのアップロードに失敗しました。」を返さなければならない（SHALL）。応答とログに署名URLまたは元例外の内容を含めてはならない（MUST NOT）。

#### Scenario: Upload先のheader timeout

- **WHEN** 発行済みuploadUrlへのmultipart送信がheader timeoutで失敗する
- **THEN** 500本文は固定errorであり、本文とログに署名URLを含まない

#### Scenario: Upload先の通信例外

- **WHEN** 発行済みuploadUrlへのfetchがURLを含む通信例外で失敗する
- **THEN** 500本文は固定errorであり、本文とログに署名URLと元例外を含まない
