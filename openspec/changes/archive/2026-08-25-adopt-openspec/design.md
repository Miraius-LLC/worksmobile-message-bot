## Context

このリポジトリにはADR、AGENTS、README、CONTEXT、テストがあるが、個々のcontract変更について要求・方針・手順を共通形式で受け渡す標準がなかった。OpenSpecはこの空白だけを埋め、product runtimeには組み込まない。

Graphify / CodeGraphはすでに利用可能だが、CodeGraphのlocal index除外がroot `.gitignore`だけに依存し、fresh worktreeへportableな設定が引き継がれない差分がある。

## Goals / Non-Goals

**Goals:**

- contract変更を実装前から追跡可能にする
- 既存SoTとの二重管理を防ぐ
- tasksをred→green→refactor/verifyの縦スライスにする
- local、pre-push、CIでstrict validationする
- CodeGraphのlocal data境界をfresh worktreeでも再現する

**Non-Goals:**

- 既存仕様や過去文書のbackfill
- 挙動不変の保守変更にOpenSpecを要求すること
- Graphify graphやCodeGraph DBをcommitすること
- product runtimeまたはHTTP APIの変更

## Decisions

### OpenSpec 1.10.0をexact devDependencyにする

global installによるAgent間のversion差を避ける。package scriptsでtelemetry無効とstrict validationの引数を一元管理する。

### 初期changeをarchive済み履歴として残す

導入で確定したworkflow capabilityをcurrent specに置き、導入時のproposal、design、tasks、delta specはarchiveへ残す。既存のLINE WORKS API仕様は転記しない。

### CodeGraphのlocal data境界をdirectory内ignoreで持つ

`.codegraph/.gitignore`だけをtrackedにし、同directoryのDB、daemon、socket、logを除外する。`codegraph.json`はAgent配布物とworktreeをindex対象外にする。

## Risks / Trade-offs

- contract変更ではartifact作成コストが増える。適用対象を観測可能な変更に限定して抑える。
- current specsは導入後のsubsetであり、全仕様の網羅表ではない。README、CONTEXT、ADR、testを引き続き参照する。
- strict validationをpre-pushで常時実行する分だけpush時間が増えるが、小規模なMarkdown validationなので安全性を優先する。

## Rollback

導入コミットをrevertする。product runtimeと既存local CodeGraph DBは変更しないため、サービス側のrollbackは不要である。
