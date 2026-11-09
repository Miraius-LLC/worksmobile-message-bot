# worksmobile-message-bot — Claude Code 向けプロジェクト指示

@AGENTS.md

> 共通規約は `~/.agents/AGENTS.md`。
> worksmobile-message-bot 固有の規約・注意点は **エージェント中立の `@AGENTS.md` に集約済み**（主要コマンドと詳細文書への入口は `README.md`）。Codex / agy も同じ AGENTS.md を読む。
> 本ファイルには **Claude Code 固有の設定（Agent skills の per-repo 設定）だけ**を残す。

`.claude/rules/` の frontmatter の無い rule（develop-meta が配布する `coding-conventions` / `tests` / `worktree`）は常時載る。`routes`・`services`・`tests-lineworks` は `paths:` で対象コードを触るときだけ載る。

## Agent skills

mattpocock/skills（develop-meta で導入済）の engineering skill 用 per-repo 設定。

### Issue tracker

専用 tracker は未使用。進行中・未着手作業の SoT は [`TODO.md`](./TODO.md)、機能の SoT は [HTTP API](./docs/reference/http-api.md) と [Callback](./docs/reference/callback.md)、履歴は git commits。`to-issues` / `triage` / `to-prd` は非アクティブ。詳細は [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md)。

### Domain docs

single-context。用語集 = root [`CONTEXT.md`](./CONTEXT.md)、設計決定 = [`docs/adr/`](./docs/adr/)、補助 = [`AGENTS.md`](./AGENTS.md)（運用ゴッチャ）/ [`README.md`](./README.md)（文書入口）/ [HTTP API](./docs/reference/http-api.md) / [Callback](./docs/reference/callback.md) / [`.claude/rules/`](./.claude/rules/)（routes / services / tests-lineworks）。詳細は [`docs/agents/domain.md`](./docs/agents/domain.md)。

### TDD

新機能・bugfix は `tdd` skill の red-green vertical（1 テスト → 1 実装、「書いてからテスト」にしない）で進める。`tdd` skill = workflow の SoT、[`.claude/rules/tests.md`](./.claude/rules/tests.md) = 配置 / mock の mechanics（補完関係、競合しない）。
