## ADDED Requirements

### Requirement: ADRとOpenSpecの責務と対応を同期する

長期的な技術判断を記録するADRと、その判断から生じるテスト可能な現行contractを記録するOpenSpec current specは、判断理由を重複させず双方向に参照できなければならない（SHALL）。

#### Scenario: ADRが現行contractを決定する

- **WHEN** accepted ADRを作成または変更し、観測可能または検証可能なcontractが生じる
- **THEN** Agentは同じchangeで対応するdelta specと双方向linkを追加する

#### Scenario: ADRがsupersedeされる

- **WHEN** 後続ADRが既存ADRの判断を置き換える
- **THEN** Agentは旧判断を独立current contractとして残さず、後続capabilityから判断の系譜を辿れるようにする

## MODIFIED Requirements

### Requirement: 導入後の仕様だけを段階的に蓄積する

worksmobile-message-botは既存文書をOpenSpec current specsへ無差別にbackfillしてはならない（MUST NOT）。ただしaccepted ADRで確定した現行contractは、一度限りのcurated baselineとして判断理由を複製せずbackfillできる（MAY）。baseline確立後は、完了したchangeのdelta specだけをarchive時に`openspec/specs/`へ反映しなければならない（SHALL）。

#### Scenario: 導入時点のcurrent specs

- **WHEN** OpenSpec導入時点でaccepted ADR由来の現行contractがcurrent specに存在しない
- **THEN** AgentはADRとの対応を明示し、テスト可能な要求だけを限定的にbackfillできる

#### Scenario: Superseded ADRをbaselineへ含める

- **WHEN** superseded ADRが現行判断へ至る系譜として必要である
- **THEN** Agentはsource lineageとして参照し、独立したcurrent requirementとして復活させない

#### Scenario: 導入後のchangeを完了する

- **WHEN** OpenSpecを使った将来のchangeをarchiveする
- **THEN** Agentはそのchangeが触れたdelta specだけをcurrent specsへ統合する
