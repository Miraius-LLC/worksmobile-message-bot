# OpenSpec導入 Design

**Status:** Approved

**Scope:** OpenSpecのrepository-local導入、適用境界、検証経路、および既存Graphify / CodeGraph構成の同等性確認

**SoT:** OpenSpec changeの要求・設計・手順は`openspec/changes/`、archive後の現行仕様は`openspec/specs/`。長期判断は`docs/adr/`、共通ルールは`AGENTS.md`、実行可能な仕様はテスト、進捗は`TODO.md`、完了履歴は`CHANGELOG.md`を正とする。

**Exit condition:** OpenSpec 1.10.0がlocal・pre-push・CIでstrict validationされ、初期workflow capabilityがarchive済みで、Graphify / CodeGraphの既存構成が保持されていること。

## 背景

このリポジトリにはGraphifyとCodeGraphがすでに導入されている。`.mcp.json`、`.graphifyignore`、`.codegraph/.gitignore`、Lefthookのrefresh、ローカル生成物のignoreがAsunaroと同じ運用境界を持つため、再導入や生成物のcommitは不要である。

不足しているのは、API contractや入力条件などの変更要求を、実装前からAgent間で追跡するOpenSpecの運用である。

## 決定

### Repository-local tool

- `@fission-ai/openspec`は最新確認済みの`1.10.0`をexact devDependencyにする。
- `bun run spec -- <command>`と`bun run spec:validate`を正規入口とする。
- telemetryは`OPENSPEC_TELEMETRY=0`で無効化する。
- product runtimeには組み込まない。

### 適用境界

次の変更では実装前にactive changeを作る。

- HTTP endpoint、request、response、status codeなどのAPI contract
- 入力項目、必須条件、validation条件
- 保存条件、状態遷移、不変条件
- 認証・認可・公開境界
- callback転送や外部API連携における観測可能な振る舞い

次の変更にはOpenSpecを要求しない。

- 挙動不変のrefactor
- 依存関係だけの更新
- typoや説明文だけの修正
- テスト追加だけで既存contractを変えない変更

### SoTとartifact

- `proposal.md`: なぜ変更するか、scopeとimpact
- `specs/*/spec.md`: テスト可能な要求差分とscenario
- `design.md`: 今回のchangeに限る実装方針
- `tasks.md`: red→green→refactor/verifyで完結する縦スライス
- `docs/adr/`: 長期判断とtrade-off
- テスト: 実行可能な仕様

既存仕様は一括backfillしない。導入後にOpenSpecを使って変更したcapabilityだけをarchive時に`openspec/specs/`へ蓄積する。

### 検証

- `bun run spec:validate`は`openspec validate --all --strict --no-interactive`を実行する。
- pre-pushは全テストに加えてOpenSpec strict validationを常時実行する。
- CIのcheck jobでも同じpackage scriptを実行する。
- repository contract testでversion、scripts、config、hook、CI接続を固定する。

### Graphify / CodeGraph

既存構成を維持する。

- Graphifyはpost-merge / post-rebaseで`graphify-refresh`を実行する。
- CodeGraphは`.mcp.json`のlocal stdio MCPとして使う。
- `graphify-out/`と`.codegraph/`はlocal cacheとしてcommitしない。
- graphは候補探索用であり、source・test・docsの代替にしない。

## ロールバック

OpenSpec導入コミットをrevertすればproduct runtimeに影響せず撤去できる。Graphify / CodeGraph既存設定は変更しないため、ロールバック対象に含めない。
