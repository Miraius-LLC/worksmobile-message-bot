---
name: tdd
description: ~/Develop/ 配下でTDD、test-first、red-green-refactorによる機能追加・バグ修正を行うときに使う。対応する superpowers:test-driven-development の明示指定は指定先を優先し、同じTDDを二重実行しない。島外はpluginの入口を使う。
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle: consult them before and during the loop, not after.

When exploring the codebase, read `GLOSSARY.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?" Give each proposed seam a one-line note on what it catches and what it misses.

When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "codebase-design" for the vocabulary. It is the shared source of the module, interface, depth, seam, adapter, leverage and locality terms, and it is a reference to consult, not a session to run.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (see the `code-review` skill), not the red → green implementation cycle.

## Develop routing

`~/Develop/` 配下の通常依頼は `tdd` を入口とする。明示指定は指定先を優先し、島外は `superpowers:test-driven-development` の既存入口と手順を使う。島外には以下のcrate制約を適用しない。

島内では参照は1回、TDDと検証は1巡とし、同じRED→GREENを二重実行しない。pluginの必要手順を参照しても島skillへ呼び戻す循環を作らない。

### 島のRust検証gate（案1）

以下のcargo／crate制約はRust作業に適用する。TS／Bunは対象repoの検証規約に従う。

`superpowers:test-driven-development` のproject全suite要求は、島の変更crateを限った検査と衝突する。島内のRust作業は変更したcrateについて `cargo test -p <crate>`・`cargo fmt -p <crate> --check`・`cargo clippy -p <crate> --all-targets -- -D warnings` を正とし、全体検証はCIへ委ねる。`--workspace` / `--all` やworkspace rootでの `-p` なし検証は実行しない。

pluginの手順を参照する場合も、pluginを明示指定された場合も、島内ではこのcrateを限った検査を保つ。明示pluginの経路でも本notesと島のgateを確認し、全suite要求を黙って読み替えない。必要手順と両立できなければ実行前に停止し、当該組の有効化を保留する。Formationでは司令塔へRED（継続可）またはBLOCKED（停止）で報告し、判断を仰ぐ。
