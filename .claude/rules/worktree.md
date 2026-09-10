# Worktree 運用ルール

コード編集タスクは常に **git worktree で分離** する。`main` を直接編集しない。新規 worktree は `.claude/worktrees/<name>` 配下に作る (`.gitignore` 済)。

herdr が切る worktree は `~/Develop/.worktrees/<repo>/<branch>` に置く（`~/.config/herdr/config.toml` の `[worktrees] directory`）。親階層に `~/Develop` が入るので島の CLAUDE.md / lessons が継承される。`worktree.created` の初期化は develop-meta 所有の `develop-meta.worktree-init` pluginへ移設中。第2段完了までは agent-room 版が稼働する。eventは `worktree-init <checkout> --json` を呼び、未配布はuser scopeのSessionStart hookがdegradedとして警告する。

日常の作成は `herdr-worktree-create` で同期初期化し、eventは他経路の保険とする。配布CLIの `--target-root` はcommon-dir一致なら島外も許容するが、`worktree-init` は島内限定。新pluginは島外を `outside_island` でskipし通知しない。Codex `--worktree` の島外checkoutは非対応なので、島内worktreeを作成・初期化して `codex -C <path>` で入る。CLI生成先の設定変更可否は未確認。詳細・実測は `~/Develop/docs/develop-operations.md` のworktree節を参照する。

**Herdr の TUI（`new_worktree` キー / sidebar の +）は workspace を開いた時の cwd で repo を決める**（upstream herdrdev/herdr#3214）ので、`~/Develop` で開いた workspace から子 repo へ `cd` して作ると develop-meta の worktree になる。子 repo の worktree は `~/Develop/bin/herdr-worktree-create [<branch>]`（pane の実 cwd から主 checkout を引き、`git worktree add` → `worktree-init` → `herdr worktree open` の順で開く。先に初期化するので初回 prompt の `.envrc is blocked` も出ない。`prefix+shift+g` の popup も同じ）で作るか、workspace 自体を子 repo の cwd で開く。

`worktree-init` は `targets` の子repoと `metaRoot` のDevelop自身が対象で、Macでも初期化でき、toolをmise shim → Homebrew → 既存PATHで解決し、Bun/direnv不在はhint付きskip、git不在は `blocked` / exit 2とする。開発・commitはdevで行う。台帳はcanonicalが既定で、bootstrap時だけ `--ledger <absolute-path>` を明示する。診断の `--check --json` / `--dry-run --json` は無書込みで `would_*` を返し、exit 0でも準備完了とは限らない。子コマンド120秒・全体360秒、`timeout` / `failed` / `blocked` とskipのreasonは `~/Develop/docs/develop-operations.md` のworktree節で復旧手順を確認する。

## 基本フロー

1. **開始**: devで新しい worktree とブランチを切り、worktree内で `~/Develop/bin/worktree-init "$(git rev-parse --show-toplevel)"` を実行する。failedと必要なrepo固有準備を解消してから作業する
2. **作業**: worktree の中で読み書き → テスト → commit (pre-commit hook が走る)
3. **離脱**: 変更を残したままセッションを main 側に戻す
4. **取り込み**: `main` から ff-only でマージ
5. **公開**: `git push origin main` (pre-push hook の全件テストが走る)
6. **後片付け**: worktree とブランチを削除

Claude Code から実行する時の対応:

| ステップ | 操作 |
|---|---|
| 1. 開始 | `EnterWorktree` ツール (`name` を渡す) → `worktree-start` の初期化・repo固有分岐 |
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
- `git push origin main` 直前に **全件テストが走る** (各プロジェクトの `lefthook.yml` で定義された pre-push hook、例: `feature-test` / `full-test`)。落ちたら原因を直してから push する
