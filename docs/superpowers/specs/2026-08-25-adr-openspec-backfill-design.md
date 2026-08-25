# 既存ADRのOpenSpec backfill設計

**Status:** Approved

**Scope:** ADR-0001〜ADR-0011で確定している現行contractをOpenSpec current specsへ一度だけbackfillし、ADRとcapabilityの対応を機械検証する。

**SoT:** 判断理由・比較案・trade-offは`docs/adr/`、テスト可能な現行contractは`openspec/specs/`、実行可能な仕様はテストコードを正とする。

**Exit condition:** 11件すべてのADRが7つのOpenSpec capabilityへ対応し、双方向リンク、strict validation、coverage test、全体検証が成功していること。

## 背景

OpenSpec導入時は既存仕様を一括backfillせず、導入後のdeltaだけを蓄積する方針とした。その後、既存ADRにもOpenSpecを適用する方針が明示されたため、OpenSpecの適用境界を変更する。

ADRをそのままOpenSpecへ複製すると、判断理由や選択肢のSoTが二重化する。本変更ではADR本文をspec化せず、ADRが確定した外部contractとfitness functionだけをRequirement / Scenarioへ変換する。

## Capability境界

ADR番号ではなく、利用者または運用者から見た現行contract単位で7 capabilityにまとめる。

| Capability | 根拠ADR | 現行contract |
|---|---|---|
| `dual-runtime-deployment` | ADR-0001、0002、0008、0010 | 共通Hono app、Workers / Cloud Run独立deploy、container HTTP/1.1、Docker / Cloud Build制約 |
| `lineworks-jwt-authentication` | ADR-0003 | `node:crypto`によるRS256 JWT、固定audience、Base64 private key |
| `callback-delivery` | ADR-0004、0005 | 5分best-effort dedup、検証済みraw callbackの設定可能upstreamへの同期転送、失敗時解除 |
| `public-http-authentication` | ADR-0006 | root、health probe、callbackを除くBASIC認証境界とHTTPException透過 |
| `message-type-dispatch` | ADR-0007 | schema mapをSoTとするmessage type route / dispatcher、個別senderを持たない構成 |
| `deployment-security` | ADR-0009 | 専用runtime SA、Secret Manager、公開設定からの環境固有値排除 |
| `adr-publication-integrity` | ADR-0011 | private原文を公開せず、対象ADRのsanitized recordとdigestを検証する契約 |

ADR-0001はADR-0010でsupersededされているため、独立した現行Requirementは作らない。`dual-runtime-deployment`のlineageとしてリンクし、現行contractはADR-0010を基準にする。

## OpenSpec change

active change名は`backfill-adr-contracts`とする。

- 7 capabilityのdelta specを追加する。
- `change-specification-workflow`を変更し、既存ADRの確定contractに限るcurated backfillを許可する。
- 既存仕様全般を無制限にbackfillする方針には変更しない。
- 実装・検証後にchangeをarchiveし、7 capabilityと更新済みworkflow specをcurrent specsへ反映する。
- OpenSpec導入時のarchiveは当時の判断履歴なので書き換えない。

## ADRとのリンク

各ADRの標準構造部分へ`OpenSpec capability`リンクを追加する。Original RecordまたはSanitized Original Recordの本文、legacy SHA-256、public digestは変更しない。

各current specからも根拠ADRへ相対リンクを張る。これにより次の責務を分けたまま往復できる。

- ADR: なぜその判断をしたか、何と比較したか、どんなtrade-offがあるか
- OpenSpec: 現在何を満たさなければならないか、どのscenarioで確認するか
- テスト: contractが実際に守られているか

## 機械検証

`openspec-adr-coverage.test.ts`を追加し、固定mappingを使って次を検証する。

- ADR-0001〜0011が過不足なく1つ以上のcapabilityへ割り当てられている
- 各ADRに期待するcurrent specへのリンクがある
- 各current specに根拠ADRへのリンクがある
- superseded ADR-0001が現行contractとして独立spec化されていない
- 7 current specsとworkflow specがOpenSpec strict validationを通る

CIのBiome対象へ新しいroot contract testを追加する。通常の`bun test`、pre-push、CIは既存経路のまま利用する。

## 文書運用の変更

`docs/conventions/documentation.md`、`openspec/config.yaml`、`change-specification-workflow`を同じ変更単位で同期する。

新しい方針は次のとおり。

- 既存仕様の無差別なbackfillは行わない。
- accepted ADRとsuperseded ADRの後継関係から導ける現行contractは、今回のcurated baselineとしてbackfillする。
- 今後は通常どおりactive changeのdeltaだけをarchiveする。
- 新しいADRが観測可能なcontractを確定する場合、同じ変更単位で対応capabilityを追加または更新する。

## リスクと対策

- **二重管理:** rationaleをOpenSpecへコピーせず、specからADRを参照する。
- **古い判断の現行化:** acceptedだけを現行Requirementへ変換し、superseded ADRはlineageに限定する。
- **digest破損:** Original Record / Sanitized Original Record内部を変更せず、全体testで既存監査を通す。
- **specの過剰分割:** ADR番号ではなく7つのcontract境界にまとめる。
- **将来drift:** ADRとspecの双方向link coverageをroot contract testで固定する。

## ロールバック

backfill commitをrevertし、7 current specs、ADRリンク、coverage test、workflow方針変更をまとめて戻す。ADRの判断本文、product runtime、deploy設定、既存テストの挙動は変更しないため、サービス側rollbackは不要である。
