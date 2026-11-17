---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "code-review" to review the work.

Commit your work to the current branch.

<fujii-notes>
- Develop の用語の正本は `GLOSSARY.md` ではなく repo の `CONTEXT.md` を参照する。
- TypeScript の実行と依存操作は repo の Bun 規約に従い、`npm` / `npx` の例は `bun` / `bunx` に読み替える。
- 完了時に未導入の `/handoff` を呼ばず、`shimekukuri` の検証・review・出荷手順に従う。
</fujii-notes>
