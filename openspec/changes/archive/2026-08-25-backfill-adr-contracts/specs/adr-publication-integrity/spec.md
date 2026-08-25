## ADDED Requirements

### Requirement: 公開できないOriginal Recordをsanitized recordで置換する

公開repositoryのADRに秘密値または公開不適切なenvironment固有値を含むOriginal Recordがある場合、公開版ADRは内容を復元せずSanitized Original Recordを保持しなければならない（SHALL）。

Source ADR: [ADR-0011](../../../../../docs/adr/0011-sanitized-original-record-for-public-repository.md)

#### Scenario: Protected ADRを公開する

- **WHEN** private originalに公開できない値が含まれる
- **THEN** public ADRは値をplaceholderへ置換したsanitized recordだけを掲載する

### Requirement: Private originalとsanitized recordのdigestを保持する

sanitized ADRはprivate originalの照合用digestと、公開sanitized record自身の完全性を検証するdigestを区別して保持しなければならない（SHALL）。

#### Scenario: Sanitized recordの改変を検証する

- **WHEN** repository testがsanitized recordを読み込む
- **THEN** 算出したdigestがADRに記録されたsanitized digestと一致する

#### Scenario: Private originalとの対応を監査する

- **WHEN** 権限を持つ人がprivate originalを照合する
- **THEN** ADRに記録されたprivate digestを使い、秘密値を公開repositoryへ復元せず同一性を確認できる

### Requirement: Protected record外のmetadata変更を許容する

ADRのnavigation linkやstatus等、digest対象record外のmetadataはprotected recordの完全性を変えずに更新できなければならない（SHALL）。

#### Scenario: OpenSpec linkを追加する

- **WHEN** ADRへ対応capabilityのlinkを追加する
- **THEN** Original RecordまたはSanitized Original Recordとそのdigestは変更されない

### Requirement: 二層digestのsanitized exceptionを明示対象だけに限定する

private原文とpublic sanitized本文の二層digestで保護する例外はADR-0001、ADR-0004、ADR-0005だけへ適用し、他のADRを無制限に同じ検証対象として扱ってはならない（MUST NOT）。

#### Scenario: 二層digest対象を検証する

- **WHEN** repository validatorがprivate / public digestの対応を検査する
- **THEN** 明示対象のADR-0001、ADR-0004、ADR-0005だけへ二層digest contractを適用する
