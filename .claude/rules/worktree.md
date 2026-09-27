# Worktree 運用ルール

実装・検証は専用のGit linked worktreeで行い、共有checkoutの変更を保護します。

1. repo rootで `git rev-parse --show-toplevel`、`git status --short --branch`、`git worktree list` を確認します。既存のdirty変更・他者のbranch/worktreeを引き継いだり掃除したりしません。
2. taskが指定したbaseと、未使用のbranch名・worktree pathを選びます。repoがignoreするworktree置き場があれば使い、無ければcheckoutの外に置きます。新規branchなら `git worktree add -b <branch> <path> <base>`、既存branchなら `git worktree add <path> <branch>` で作成します。
3. worktree内で `git rev-parse --show-toplevel`、`git branch --show-current`、`git status --short --branch` を確認し、作業対象を固定します。依存準備とsecret設定はrepo内の手順だけを使い、別checkoutから `.env` を無条件にコピーしません。
4. 割当範囲だけ編集し、repoの通常hookと必要な検証を通してcommitします。merge・pushはtaskとrepoの権限が明示的に認める場合にだけ行います。
5. 作業を閉じるときは、自分が作成したcleanなworktreeだけを `git worktree remove <path>` で片付けます。dirtyまたは所有者不明のworktreeは残して確認を得ます。

来歴（出典。配布先から参照する手順ではありません）: `develop-meta/AGENTS.md` §5、`develop-meta/docs/develop-operations.md` のworktree手順。
