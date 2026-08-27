# change-specification-workflow Specification

## Purpose

worksmobile-message-botのcontract変更について、既存SoTの責務を維持しながら、今回の要求・実装方針・縦スライスの実装手順をAgent間で追跡可能にする。

## Requirements

### Requirement: 観測可能なcontract変更をOpenSpecで管理する

worksmobile-message-botは、HTTP API contract、入力validation、保存条件、状態遷移・不変条件、認証・認可境界、またはcallback・外部API連携の観測可能な挙動を変更する作業について、実装着手前にactive changeを作成しなければならない（SHALL）。

#### Scenario: HTTP API contractを変更する

- **WHEN** endpoint、request、response、またはstatus codeを変更する
- **THEN** Agentは影響する要求、scenario、実装方針、縦スライスのtasksをactive changeへ記録してから実装する

#### Scenario: 認証境界を変更する

- **WHEN** 公開path、BASIC認証、callback署名検証、またはupstream認証headerの条件を変更する
- **THEN** Agentは許可・拒否される境界と期待statusをactive changeへ記録する

### Requirement: 挙動不変の保守変更を適用対象外とする

worksmobile-message-botは、利用者または連携先から観測できるcontractを変えない保守変更について、OpenSpec changeの作成を要求してはならない（MUST NOT）。

#### Scenario: 依存関係だけの更新を行う

- **WHEN** 公開APIとruntime挙動を変えずに依存関係だけの更新を行う
- **THEN** AgentはOpenSpecを作成せず、通常のtestとreviewで検証できる

#### Scenario: 挙動不変のrefactorを行う

- **WHEN** 外部contractを変えずに内部moduleを整理する
- **THEN** AgentはOpenSpecを作成せず、既存testで挙動不変を固定する

### Requirement: 既存SoTと責務を重複させない

OpenSpecは、長期的な技術判断を`docs/adr/`、全Agent共通ルールを`AGENTS.md`、現在の構成を`README.md`と`CONTEXT.md`、実行可能な仕様をテストに委ね、今回の変更要求・実装方針・実装手順だけを保持しなければならない（SHALL）。

#### Scenario: 長期判断を伴う

- **WHEN** 変更が後から戻しにくい技術判断を含む
- **THEN** changeのdesignは判断理由を複製せず、同じ変更単位で作成または更新するADRを参照する

#### Scenario: 完了した変更をarchiveする

- **WHEN** 実装、テスト、関連SoTの同期が完了する
- **THEN** Agentはdelta specをcurrent specへ反映し、変更履歴をarchiveする

### Requirement: tasksを縦スライスで進める

OpenSpecのtasksは、テスト作成と実装を別phaseに分離せず、各挙動をred、green、refactor/verifyの順に完結させなければならない（SHALL）。

#### Scenario: 実行可能な挙動を実装する

- **WHEN** taskがコードの挙動変更を含む
- **THEN** 同じtask内で失敗するテストを先に確認し、最小実装で通し、refactorと関連検証まで完了する

### Requirement: OpenSpecをrepository-localに検証する

worksmobile-message-botはOpenSpec 1.11.0をexact devDependencyとして保持し、repository scriptからtelemetryを無効化してstrict validationを実行できなければならない（SHALL）。

#### Scenario: 仕様を検証する

- **WHEN** 開発者、pre-push hook、またはCIが`bun run spec:validate`を実行する
- **THEN** repository-localのOpenSpec 1.11.0がtelemetry無効で全active changeとcurrent specをstrict validationする

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

### Requirement: ADRとOpenSpecの責務と対応を同期する

長期的な技術判断を記録するADRと、その判断から生じるテスト可能な現行contractを記録するOpenSpec current specは、判断理由を重複させず双方向に参照できなければならない（SHALL）。

#### Scenario: ADRが現行contractを決定する

- **WHEN** accepted ADRを作成または変更し、観測可能または検証可能なcontractが生じる
- **THEN** Agentは同じchangeで対応するdelta specと双方向linkを追加する

#### Scenario: ADRがsupersedeされる

- **WHEN** 後続ADRが既存ADRの判断を置き換える
- **THEN** Agentは旧判断を独立current contractとして残さず、後続capabilityから判断の系譜を辿れるようにする
