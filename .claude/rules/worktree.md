# Worktree 運用ルール

コード編集タスクは常に **git worktree で分離** する。`main` を直接編集しない。新規 worktree は `.claude/worktrees/<name>` 配下に作る (`.gitignore` 済)。

## 基本フロー

1. **開始**: 新しい worktree とブランチを切る
2. **作業**: worktree の中で読み書き → テスト → commit (pre-commit hook が走る)
3. **離脱**: 変更を残したままセッションを main 側に戻す
4. **取り込み**: `main` から ff-only でマージ
5. **公開**: `git push origin main` (pre-push hook の full test が走る)
6. **後片付け**: worktree とブランチを削除

Claude Code から実行する時の対応:

| ステップ | 操作 |
|---|---|
| 1. 開始 | `EnterWorktree` ツール (`name` を渡す) |
| 2. 作業 | 通常通り Edit / Write / Bash |
| 3. 離脱 | `ExitWorktree` ツール (`action: "keep"`) |
| 4. 取り込み | `git merge --ff-only worktree-<name>` |
| 5. 公開 | `git push origin main` |
| 6. 後片付け | `git worktree remove .claude/worktrees/<name>` → `git branch -d worktree-<name>` |

## なぜ worktree か

- main を汚さないので「途中で別タスクが割り込んだ」時に main へ即戻れる
- pre-commit / pre-push hook で「未完成のままうっかり push」を防げる
- 1 コミット 1 ブランチに揃えると、後から `git log` を読んでも追跡しやすい

## 守るべきこと

- **`main` を直接編集しない**。緊急 hotfix でも worktree を 1 つ切る
- `EnterWorktree` で作った worktree は使い終わったら `ExitWorktree action="keep"` で離脱、main にマージしてから `git worktree remove` で消す。残しっぱなしにしない
- ブランチ削除 (`git branch -d`) は **main にマージ済みである** ことを `git -d` 自身に確認させる (`-D` で強制削除しない)
- `git push origin main` 直前に `full-test` が走る (`lefthook.yml` の `pre-push`)。落ちたら原因を直してから push する
