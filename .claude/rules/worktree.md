# Worktree 運用ルール

コード編集は常に **git worktree で分離** し、`main` を直接編集しない（緊急 hotfix でも 1 つ切る）。新規 worktree は `.claude/worktrees/<name>`（`.gitignore` 済）、Herdr が切る worktree は `~/Develop/.worktrees/<repo>/<branch>` に置く。どちらも親階層に `~/Develop` が入るので島の CLAUDE.md / lessons が継承される。

- 作成直後に `~/Develop/bin/worktree-init "$(git rev-parse --show-toplevel)"` を回し、failed を解消してから作業する。**exit 0 でも準備完了とは限らない**（`would_*` / skip の読み方と復旧は `~/Develop/docs/develop-operations.md` の worktree 節）
- 子 repo の Herdr worktree は `~/Develop/bin/herdr-worktree-create [<branch>]`（`prefix+shift+g`）で作る。Herdr の TUI / sidebar の + は workspace を開いた repo で切るため（upstream herdr#3214）
- Codex の `--worktree` は島外に作られ `worktree-init` が拒否するので使わない。島内 worktree を作って `codex -C <path>` で入る

## 基本フロー

| ステップ | 操作（Claude Code） |
|---|---|
| 1. 開始 | `EnterWorktree`（`name` を渡す）→ `worktree-start` の初期化・repo 固有分岐 |
| 2. 作業 | worktree の中で読み書き → テスト → commit（pre-commit hook が走る） |
| 3. 離脱 | `ExitWorktree`（`action: "keep"`） |
| 4. 取り込み | `main` から `git merge --ff-only worktree-<name>` |
| 5. 公開 | `git push origin main`（pre-push の全件テストが走る。落ちたら原因を直してから push） |
| 6. 後片付け | `git worktree remove .claude/worktrees/<name>` → `git branch -d worktree-<name>` |

branch は `git branch -d` で消し、main へのマージ済みを git 自身に確かめさせる。使い終わった worktree は残さない。
