---
name: grill-with-docs
description: 立てた計画を、既存ドメインモデル・用語集 (CONTEXT.md) と決定記録 (ADR) に照らして 1 問ずつ容赦なく詰める「グリル」セッション。曖昧な語を正規語に研ぎ、コードとの矛盾を炙り出し、確定するたび CONTEXT.md / ADR をその場で更新する。「計画を docs に照らして詰めたい」「設計をグリルして」「用語を整理しながら計画をstress-testしたい」「ドメインモデルと矛盾しないか確認したい」「grill my plan against the docs」などのときに使用する。
---

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-info>

<fujii-notes>

## 藤井運用メモ (このリポジトリへの適応)

- 出典: Matt Pocock の skills (`mattpocock/skills` の `skills/engineering/grill-with-docs`, MIT)。本体は週次 launchd (`com.fujimogn.sync-mattpocock-skills`) で upstream から自動同期される。**この SKILL.md を直接編集しない** — カスタマイズ (この日本語 description / 本メモ) は `~/Develop/.claude/skills-overlay/` で管理し、同期のたび重ねられる。
- **語彙は日本語でも研ぐ**: 福祉ドメインの語彙判断は `internal.md` D1 に従い「現場語感」を優先し、2〜4 案 + 根拠を提示して藤井に選定してもらう。グリルの語彙確定は機械的直訳で決め打ちしない。
- **既存のドメイン doc 名に合わせる**: 上記の `CONTEXT.md` は本 skill のデフォルト名。プロジェクトに既存のドメイン doc (例: asunaro の `docs/domain.md`) があるなら、新規に `CONTEXT.md` を作らず**既存ファイルを SoT として更新**する (二重管理を避ける。internal.md D1 と整合)。どちらを正とするか不明なら藤井に確認する。
- グリルは応答言語規約に従い**日本語で進行**する (instruction 本体は英語のままで問題ない)。

</fujii-notes>
