---
name: grill-with-docs
description: 立てた計画を、既存ドメインモデル・用語集 (CONTEXT.md) と決定記録 (ADR) に照らして 1 問ずつ容赦なく詰める「グリル」セッション。曖昧な語を正規語に研ぎ、コードとの矛盾を炙り出し、確定するたび CONTEXT.md / ADR をその場で更新する。「計画を docs に照らして詰めたい」「設計をグリルして」「用語を整理しながら計画をstress-testしたい」「ドメインモデルと矛盾しないか確認したい」「grill my plan against the docs」などのときに使用する。
disable-model-invocation: true
---

Run a `/grilling` session, using the `/domain-modeling` skill.

<fujii-notes>

## 藤井運用メモ (このリポジトリへの適応)

- 出典: Matt Pocock の skills (`mattpocock/skills` の `skills/engineering/grill-with-docs`, MIT)。本体は週次 launchd (`com.fujimogn.sync-mattpocock-skills`) で upstream から自動同期される。**この SKILL.md を直接編集しない** — カスタマイズ (この日本語 description / 本メモ) は `~/Develop/.claude/skills-overlay/` で管理し、同期のたび重ねられる。
- **語彙は日本語でも研ぐ**: 福祉ドメインの語彙判断は `internal.md` D1 に従い「現場語感」を優先し、2〜4 案 + 根拠を提示して藤井に選定してもらう。グリルの語彙確定は機械的直訳で決め打ちしない。
- **既存のドメイン doc 名に合わせる**: 上記の `CONTEXT.md` は本 skill のデフォルト名。プロジェクトに既存のドメイン doc (例: asunaro の `docs/domain.md`) があるなら、新規に `CONTEXT.md` を作らず**既存ファイルを SoT として更新**する (二重管理を避ける。internal.md D1 と整合)。どちらを正とするか不明なら藤井に確認する。
- グリルは応答言語規約に従い**日本語で進行**する (instruction 本体は英語のままで問題ない)。

</fujii-notes>
