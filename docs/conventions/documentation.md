# ドキュメント運用規約

worksmobile-message-botの文書は目的ごとにSoT（Single Source of Truth）を1つだけ持つ。同じ要求、判断、進捗を複数の文書へ全文コピーしない。

## SoTの分界

| 内容 | SoT | 責務 |
|---|---|---|
| 長期的な設計判断 | [`docs/adr/`](../adr/) | 背景、選択肢、決定、影響 |
| 全Agent共通ルール | [`AGENTS.md`](../../AGENTS.md) | 常設の開発規約と参照導線 |
| 現在の構成・利用方法・用語 | [`README.md`](../../README.md) / [`CONTEXT.md`](../../CONTEXT.md) | 現行の外部仕様と構成、正規語 |
| 今回の変更要求 | `openspec/changes/<change>/specs/` | 現行仕様に対する要求差分とscenario |
| 今回の実装方針 | `openspec/changes/<change>/design.md` | change内で採る方針、影響、rollback |
| 今回の実装手順 | `openspec/changes/<change>/tasks.md` | red→green→refactor/verifyの縦スライス |
| archive後の現行仕様 | `openspec/specs/<capability>/` | OpenSpec導入後に変更した仕様のsubset |
| 実行可能な仕様 | テストコード | 受入条件、境界値、回帰防止 |
| 未着手・進行中 | [`TODO.md`](../../TODO.md) | 次の行動、依存、完了条件 |
| 完了履歴 | [`CHANGELOG.md`](../../CHANGELOG.md) | 完了した変更の短い要約とSoTへのリンク |

## OpenSpecを使う変更

次のいずれかに当たる変更は、実装前にOpenSpec active changeを作る。

- HTTP endpoint、request、response、status codeなどのAPI contractを変える
- 入力項目、必須条件、validation条件を変える
- 保存条件、状態遷移、ドメイン不変条件を変える
- BASIC認証、callback署名、公開pathなどの認証・認可境界を変える
- callback転送やLINE WORKS API連携の観測可能な挙動を変える

次の変更にはOpenSpecを要求しない。

- 外部挙動を変えないrefactor
- 依存関係だけの更新
- typo、コメント、説明文だけの修正
- 既存contractを変えないテスト追加

判断に迷う場合は「利用者または連携先から観測できるcontractが変わるか」を基準にする。変わる場合はOpenSpec、変わらない場合は通常のTDD・reviewで扱う。

## Artifactの責務

- `proposal.md`には変更理由、scope、impactを書く。
- delta `spec.md`にはテスト可能なRequirementとWHEN / THEN scenarioを書く。
- `design.md`には今回の実装方針を書く。長期判断の理由はADRへ置き、複製しない。
- `tasks.md`はテストphaseと実装phaseに分けず、各項目をred→green→refactor/verifyで完結させる。
- archive前に実装、テスト、README / CONTEXT / ADRなど影響する現行SoTを同期する。

`openspec/specs/`はリポジトリ全仕様の網羅表ではない。既存仕様を一括backfillせず、OpenSpec導入後に変更したdelta specだけを段階的に蓄積する。

## 検証

- 手動: `bun run spec:validate`
- pre-push: 全テストとOpenSpec strict validation
- CI: check jobでOpenSpec strict validation

OpenSpecのversionとCLI引数は`package.json`のscriptsを正とし、hookやCIからCLIを直接組み立てない。
