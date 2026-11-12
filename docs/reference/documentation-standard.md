# TODO.md と CHANGELOG.md

この repo の直下 `TODO.md` と `CHANGELOG.md` の書き方である。数値の例外は作らない。検査には `.develop-tools/resolve pre-commit check-staged-docs`、退避には `.develop-tools/resolve ci archive-changelog` を使う。

## 役割

| 情報 | 置く場所 |
|---|---|
| 未完了の作業・判断・運用 gate | `TODO.md` |
| 完了した節目 | `CHANGELOG.md` |
| 計画・経緯・測定・調査・長い review | この repo の plan / review |
| 長く効く設計判断 | この repo の ADR |
| 実装の履歴 | `git log` |

完了済みの経緯、検証値、調査記録は TODO と CHANGELOG に再掲しない。

## TODO.md

未完了だけを置く。`- [x]` は残さない。完了したら削除する。残る gate だけを新しい未完了項目にする。

1 項目は完了条件が一つである。各項目は「現在地 → 次 → 完了条件 → この repo 内の SoT へのリンク」を書く。実装経緯、検証値、調査履歴は書かない。

```markdown
- [ ] **残作業の名前**。現在地: 根拠のある状態。次: 一つの行動。完了条件: 第三者が確認できる結果。[TODO](../../TODO.md)
```

リンクは `docs/reference/documentation-standard.md` から見た、この repo 内の相対 path にする。

`##` 見出しは次の 4 語だけを、この順で使う。全部は要らず、項目の無い見出しだけのセクションも置いてよい。これ以外の `##` 見出しは置かない。分野で分けたいときは、項目名の先頭に分野を書く（例 `- [ ] **給料計算: …**`）。

| 見出し | 置く項目 |
|---|---|
| `## 進行中` | 今手を動かしている、または次の一手が決まっている |
| `## 次に着手` | 着手できるが、まだ始めていない |
| `## 待ち` | 外部要因・人の判断・モノや現地の都合で止まっている。理由は各項目の現在地に書く |
| `## いつか` | 時期未定 |

## CHANGELOG.md

1 行目は `# Changelog`。最初の `##` より前に、古い詳細は git 履歴に任せる blockquote を置く。

月見出しは `## YYYY-MM` だけにする。新しい月を先に置く。

1 項目は 1 つの完了した変更内容にする。出荷の単位や push の単位で複数の変更をまとめない。commit ごとの経過、未完了作業、手順、長い review は書かず、詳細は plan / review / ADR へのリンクにする。

トップレベル項目の形は `.config/develop-tools.json` の宣言で決める。日付は実際の完了日とし、月見出しの月と一致させる。

- `release.changelogStamp: true` の repo は括弧内の日付の直後に印を置く。未リリースは `- **題（YYYY-MM-DD/⏳）**: 本文`、Release がある版は `- **題（YYYY-MM-DD/[vX.Y.Z](https://github.com/<owner>/<repo>/releases/tag/vX.Y.Z)）**: 本文`。過去の tag に GitHub Release が無い場合だけ `/vX.Y.Z` と版のみを書く。印は必須で、⏳ に異体字セレクタ U+FE0F は付けない。任意の `、短い補足` は印の後ろに置く。`release` が版 commit で `/⏳` を Release link へ書き換える。
- それ以外の repo は `- **題（YYYY-MM-DD）**: 本文` の括弧の形を使う。日付の前に空白を入れず、括弧内の日付の後ろに `、短い補足` を加えてよい。

括弧の形（刻印しない repo）:

```markdown
# Changelog

> 古い詳細は git 履歴に任せる。

## 2026-11

- **配置 hint を加えた（2026-11-04）**: 要約。
```

刻印する形（`release.changelogStamp: true` の repo）:

```markdown
# Changelog

> 古い詳細は git 履歴に任せる。

## 2026-11

- **配置先の表示を直した（2026-11-05/⏳）**: 要約。
- **配置 hint を加えた（2026-11-04/[v0.1.155](https://github.com/owner/repo/releases/tag/v0.1.155)）**: 要約。
```

## 絵文字

`#` 見出しの中に絵文字を書かない。本文・表・リストでは使ってよい。見出しの絵文字は GitHub の見出し anchor を揺らし（`⚠️` の異体字セレクタ U+FE0F の扱いが実装ごとに違う）、その見出しへの link が切れる。

## 上限

UTF-8 のバイト数である。

| 対象 | 上限 |
|---|---:|
| `TODO.md` | 36,000 B |
| `CHANGELOG.md` | 360,000 B |
| 1 項目 | 500 B を超えたら警告だけ。拒否しない |

`TODO.md` が 36,000 B を超えたら、完了項目を消し、未完了を上の形に短くする。

## 退避

`CHANGELOG.md` が 360,000 B 以下なら退避しない。超えたら、先に dry-run する。

```bash
.develop-tools/resolve ci archive-changelog
```

問題がなければ `--yes` を付ける。

```bash
.develop-tools/resolve ci archive-changelog --yes
```

古い月の節から、注記と空行を含む全文が 288,000 B 以下になるまで削る。当月の節は残す。当月が無ければ、存在する最新月を残す。削れる古い月が尽きて全文が 360,000 B 以下なら、その内容で成功する。360,001 B 以上ならファイルを変えず失敗する。

注記は次の形にする。`YYYY-MM` は今回退避した月のうち最も新しい月、SHA は退避直前の commit である。

```markdown
> YYYY-MM 以前は git 履歴（退避直前の commit: <SHA>）
```

退避した節は別ファイルへ複製しない。

## 検査

pre-commit が、stage された直下の `TODO.md` と `CHANGELOG.md` を見る。`- [x]`、総バイト上限超過、CHANGELOG の書式違反は拒否する。500 B 超は警告だけである。CI ではこの検査を強制しない。

同じ検査を手で走らせるときは、この repo の直下で次を実行する。

```bash
.develop-tools/resolve pre-commit check-staged-docs
```

道具を取得できないとき、`pre-commit` は検査を省いて終了 0 で抜ける。stderr の「検査を省きます」を見たら検査は走っていない。

一時 index を渡すときは `--index-file` を 1 回だけ付ける。path は、すでに存在する一時 index で、`git rev-parse --absolute-git-dir` の配下にある通常ファイルにする。linked worktree では `.git` はファイルなので、`.git/` の下とは限らない。
