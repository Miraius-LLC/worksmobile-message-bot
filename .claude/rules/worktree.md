# Worktree 運用ルール — 常駐入口

編集は島内の linked worktree で行う（`~/Develop/AGENTS.md` §5）。作成・初期化・取り込み・後片付けは `~/Develop/docs/develop-operations.md#worktree` と `worktree-start` skill を使う。

- `worktree-init` の exit 0 だけで準備完了と見なさず、`would_*` と skip の reason を読む。
- 子 repo の Herdr worktree は `herdr-worktree-create` から作る。Herdr TUI / sidebar の + は workspace repo を起点にする。
- Codex の `--worktree` は島外になりうる。島内 worktree を作り `codex -C <path>` で入る。
