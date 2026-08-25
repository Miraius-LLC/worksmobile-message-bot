## ADDED Requirements

### Requirement: 公開できないOriginal Recordをsanitized recordで置換する

公開repositoryのADRに秘密値または公開不適切なenvironment固有値を含むOriginal Recordがある場合、公開版ADRは内容を復元せずSanitized Original Recordを保持しなければならない（SHALL）。

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
