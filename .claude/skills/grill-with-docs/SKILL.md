---
name: grill-with-docs
description: 立てた計画を、既存ドメインモデル・用語集 (CONTEXT.md) と決定記録 (ADR) に照らして 1 問ずつ容赦なく詰める「グリル」セッション。曖昧な語を正規語に研ぎ、コードとの矛盾を炙り出し、確定するたび CONTEXT.md / ADR をその場で更新する。「計画を docs に照らして詰めたい」「設計をグリルして」「用語を整理しながら計画をstress-testしたい」「ドメインモデルと矛盾しないか確認したい」「grill my plan against the docs」などのときに使用する。
disable-model-invocation: true
---

Call the Skill tool twice, for "grilling" and "domain-modeling".

<fujii-notes>

## 藤井運用メモ (このリポジトリへの適応)

- 配布来歴: 本体は Matt Pocock の `mattpocock/skills` (`skills/engineering/grill-with-docs`, MIT) から vendoring し、このリポジトリの skills overlay を重ねて生成する。**生成済み `SKILL.md` を直接編集しない** — カスタマイズ（日本語 description / 本メモ）は overlay を正本とし、既存の vendoring 入口から生成する。Develop 内部lesson（`internal.md` D1）はこのメモの背景であり、利用者が別途参照する必要はない。
- **語彙は日本語でも研ぐ**: 福祉ドメインの語彙は「現場語感」を優先し、2〜4 案 + 根拠を提示して藤井に選定してもらう。グリルの語彙確定は機械的直訳で決め打ちしない。
- **既存のドメイン doc 名に合わせる**: 上記の `CONTEXT.md` は本 skill のデフォルト名。プロジェクトに既存のドメイン doc (例: asunaro の `docs/domain.md`) があるなら、新規に `CONTEXT.md` を作らず**既存ファイルを SoT として更新**する（二重管理を避ける）。どちらを正とするか不明なら藤井に確認する。
- グリルは応答言語規約に従い**日本語で進行**する (instruction 本体は英語のままで問題ない)。
- **ADRをemitする直前に対象repoの`docs/adr/README.md`と`docs/adr/adr-template.md`を直接読む**。既存legacy ADRやモデル記憶から形式を再構成せず、テンプレートを複製して最大番号+1・README索引同時更新まで行う。

</fujii-notes>
