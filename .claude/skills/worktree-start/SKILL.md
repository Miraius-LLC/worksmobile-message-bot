---
name: worktree-start
description: 藤井の ~/Develop/ 配下の開発プロジェクトで作業を始めるとき、main 直接編集を避けるために git worktree を立ち上げる skill。ブランチ名を確認し EnterWorktree で `.claude/worktrees/<name>` に隔離した作業空間を作る。「コードを書き始めたい」「新しいブランチを切りたい」「worktree を立てる」「~/Develop/<project>/ で機能追加を始める」など、~/Develop/ 配下のプロジェクトでコード編集を始める前に使用する。
---

# worktree-start — Develop 配下の作業 worktree 立ち上げ

`~/Develop/<project>/` 配下で作業を始める際、`main` 直接編集を避けるため git worktree を立ち上げる skill。
`~/Develop/.claude/rules/worktree.md` (各プロジェクトに sync 済) とペアで動作する。

## 前提

- 対象: `~/Develop/<project>/` 配下のプロジェクト (cwd が git repo)
- 配置先: `.claude/worktrees/<name>/` (`.gitignore` で除外済の想定)
- ブランチ命名: `worktree-<name>` (worktree.md の慣習)
- 守る原則: **main を直接編集しない**。緊急 hotfix でも worktree を切る (worktree.md §「守るべきこと」)

## フロー

### Step 1: 環境確認

```bash
git rev-parse --show-toplevel    # repo root の特定
git branch --show-current        # 現在のブランチ
git worktree list                # 既存 worktree 一覧
git status --short               # 未コミット変更の有無
```

- repo root が `~/Develop/<project>/` 配下でなければ警告して中止 (本 skill のスコープ外)
- 未コミット変更がある場合は AskUserQuestion で対応を確認 (stash / そのまま continue / 中止)

### Step 2: 既存 worktree の確認

`git worktree list` の結果から既存 worktree を提示し、AskUserQuestion で:

- **新規 worktree を切る** (デフォルト)
- **既存 worktree を再利用** (1 つ以上ある場合のみ表示)
- **中止**

### Step 3: ブランチ名の確認

新規の場合、AskUserQuestion でブランチ名 (suffix のみ) を受け取る。
suffix は kebab-case 推奨 (例: `fix-pdf-rotate`, `add-cron-status`)。

skill 側で `worktree-<suffix>` 形式に整形し、最終確認:

- worktree path: `.claude/worktrees/<suffix>/`
- branch: `worktree-<suffix>`
- base: 現在の HEAD (通常は main)

### Step 4: EnterWorktree 実行

`EnterWorktree` ツールを呼ぶ (deferred tool。ToolSearch で `select:EnterWorktree` で取得して invoke):

- `name`: `<suffix>` を渡す (ツール側が `.claude/worktrees/<name>` + `worktree-<name>` を作る想定)

ツールが使えない・失敗した場合は Bash で fallback:

```bash
git worktree add .claude/worktrees/<suffix> -b worktree-<suffix>
```

### Step 5: 作業開始の合図

```
✅ worktree 起動: .claude/worktrees/<suffix>/  (branch: worktree-<suffix>)

次のアクション:
1. 編集・テスト・commit (pre-commit hook が走る)
2. 完了後は ExitWorktree action="keep" で離脱
3. main で `git merge --ff-only worktree-<suffix>` → `git push`
4. `git worktree remove .claude/worktrees/<suffix>` → `git branch -d worktree-<suffix>`
```

NOTES.md などは作らない (Work 系 skill と違い、開発タスクは git commit が記録になる)。

## 引数による省略

`/worktree-start <suffix>` のように suffix が引数で渡された場合は Step 3 を省略し、確認 1 回 (Step 3 の最終確認) のみで Step 4 へ進む。

## 守るべきこと

- ブランチ名に `main` / `master` / `HEAD` を含めない (誤マージ防止)
- 既存ブランチ名と衝突する suffix は AskUserQuestion で別名を聞く
- `~/Work/` 配下では使わない (Work 側は worktree 運用していない)

## 関連

- `~/Develop/.claude/rules/worktree.md` — worktree 運用の基底ルール (各プロジェクトに sync 配布)
- `~/Develop/.claude/rules/commit.md` — commit 規約 (worktree 内の commit にも適用)
- `~/Develop/CLAUDE.md §1` — Develop 島の構成
