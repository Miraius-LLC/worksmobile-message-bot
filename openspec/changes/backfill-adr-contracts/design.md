## Context

設計の承認済み全体像は`docs/superpowers/specs/2026-08-25-adr-openspec-backfill-design.md`を参照する。本changeでは、ADRの判断理由・選択肢・trade-offを複製せず、現行contractと対応関係だけをOpenSpecへ追加する。

## Goals / Non-Goals

**Goals:**

- 11件のADRを重複のない7 capabilityへ整理する
- ADRとcurrent specを双方向に辿れるようにする
- 対応漏れと誤った独立spec化をmachine testで防ぐ
- 今後のchangeは従来どおりdelta-onlyで蓄積する

**Non-Goals:**

- ADRの判断理由をOpenSpecへ転記すること
- superseded ADRを現行contractとして復活させること
- 過去archiveを書き換えること
- runtime codeや外部contractを変更すること

## Decisions

### Capability mappingを固定する

| Capability | Source ADR |
|---|---|
| `dual-runtime-deployment` | ADR-0001, 0002, 0008, 0010 |
| `lineworks-jwt-authentication` | ADR-0003 |
| `callback-delivery` | ADR-0004, 0005 |
| `public-http-authentication` | ADR-0006 |
| `message-type-dispatch` | ADR-0007 |
| `deployment-security` | ADR-0009 |
| `adr-publication-integrity` | ADR-0011 |

ADR-0001はADR-0010にsupersedeされているため、独立したcurrent specを作らない。`dual-runtime-deployment`から系譜として参照する。

### 双方向リンクをprotected recordの外へ置く

各ADRの通常Markdown領域へ`OpenSpec capability`リンクを追加し、各current specの冒頭へ`Source ADR`リンクを追加する。Original Record / Sanitized Original Recordとdigest対象本文は変更しない。

### 対応表をmachine testの固定fixtureにする

testはADR-0001〜0011をちょうど1回ずつ網羅する固定mappingを持ち、ADR側リンク、spec側リンク、ADR-0001の非独立化、全current specのstrict validationを検証する。これにより自由記述の文書だけに依存しない。

### backfill例外を限定する

OpenSpecの通常運用はdelta-onlyを維持する。本changeだけをaccepted ADRに由来するcurated baselineとして扱い、READMEやCONTEXTの全量転記へ拡張しない。

## Risks / Trade-offs

- ADRとspecの二重管理が増えるため、双方向coverage testを保守コストとして受け入れる
- 7 capabilityへの集約は粒度判断を固定するが、ADRごとの細分化より関連contractを一緒に読める利点を優先する
- ADR-0001をcurrent contractにしないため履歴情報はADR側に残し、specからsource lineageとして辿れるようにする

## Rollback

本changeのarchiveで追加した7 current spec、既存workflow specへのdelta、ADR側リンク、coverage testとCI接続をrevertする。既存ADR本文と過去のOpenSpec導入archiveは変更しないため、rollback対象外とする。
