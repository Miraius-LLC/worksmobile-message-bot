## 1. Repository-local foundation

- [x] 1.1 未導入を示すcontract testを先に失敗させ、OpenSpec 1.10.0のexact devDependency、telemetry無効のscripts、project config、initial specを追加してstrict validationする（red→green→refactor/verify）

## 2. Governance and verification

- [x] 2.1 適用境界とSoT分界をAgent規約へ反映し、pre-pushとCIへ同じstrict validationを接続してcontract testを通す（red→green→refactor/verify）

## 3. Code intelligence boundary

- [x] 3.1 fresh worktreeでCodeGraph local ignoreが欠落するREDを確認し、tracked `.codegraph/.gitignore`と`codegraph.json`を追加して生成物非追跡を検証する（red→green→refactor/verify）

## 4. Closeout

- [x] 4.1 OpenSpec artifact、既存SoT、Graphify / CodeGraph境界をreviewし、全test・typecheck・lint・build・strict validationを通す（review→refactor/verify）
