# TGL lane evidence and prevention fire points

SKILL.md の義務と発火点の詳細。本文の規則をここへ複製しない。形式と取得手段だけ置く。

## run_id の取得

`run_id` は「見に行く」対象ではない。dispatch の時点で台帳に載る。取得手段は次の 2 つ。

1. **いまの dispatch**: `tgl dispatch` の標準出力に `run=` 行が出る。カンマ区切り。空なら `run=-`。JSON なら `runIds`。同じ run は assignment note `tgl dispatch run: <ids>` にも残る。
2. **既存 lane**（stdout を取り逃がした過去分を含む）: `execution_run_links` を `lane_id` で辿り、`queue_runs` の `status` / `failure_reason` を読む。失敗が lane status に書き戻されていなくても、リンクと理由は既にある。

local の読み方（D1 の `agent-room query` ではない。live DB は `file:…?mode=ro` + timeout）:

```bash
sqlite3 "file:$HOME/.local/state/agent-room/queue.sqlite?mode=ro" -cmd ".timeout 8000" \
  "SELECT l.lane_id, l.run_id, l.assignment_id, r.status, r.failure_reason
   FROM execution_run_links l
   JOIN queue_runs r ON r.run_id = l.run_id
   WHERE l.lane_id = '<lane_id>'
   ORDER BY r.created_at DESC;"
```

取れた `run_id` の中身は `agent-room run --debug <run_id>`。

## note の形式

全部 `tgl note`。1 note 1 段。`--summary` は key=value を空白区切り 1 行。ballot / PII は入れない。証跡 note は `--type coordination`（摩擦 proposal に拾わせない）。失敗の再 dispatch 理由だけ `--type retry`。

### dispatch（ship 不要。ここが発火点）

`tgl dispatch` が成功し `run=` を出した直後、次の作業の前に書く。

```text
stage=dispatch session=<id> lane=<id> run_id=<id> queue_status=pending|failed|done|unknown first_edit_at=null
```

`queue_status=failed` なら lane を working のままにしない。`lane update --status blocked` するか、`--type retry` で理由を残して再 dispatch する。

既存 lane に dispatch note が無くても、上の `execution_run_links` から同じ 1 行を後から書ける。過去分の救済はこれ。

### 作業中

`tgl status` の `no_progress` / `(no_edit)` のあと、次の dispatch の前に 1 本。`first_edit_at` が付かない working は未実行の dispatch。

```text
stage=working run_id=<id> queue_status=... first_edit_at=null|<iso> last_progress_at=<iso|null> stall=no_edit|no_progress|none
```

編集開始後の通常進捗は既存の `lane update --head` / `lane observe`。

### ship（起きたときだけ）

`tgl ship request --verification` のあと。この段が 0 件でも、dispatch / working が無い session を「証跡なし」と数える。

```text
stage=ship head=<40-char sha> verification=<command> result=pass|fail|unable
```

`unable` は met の代わり。verification 無しの ship request は skill 上 ship-ready とみなさない。

## 予防キー

`tgl review resolve` の `adoption` が `accepted` または `adjusted` のとき、同じ会話で `tgl review prevention`。finding の安定キーは `file:line` か skill 節名。決定は `adopt-backlog` / `reject` / `defer`。

次の `tgl dispatch` / `tgl plan` の `--summary` に、今回の touching に効くキーを列挙する。無ければ `prevention: none`。pending prevention がある session では CLI がこれを強制する。pending が無い session では要求しない。

## CLI が強制しないもの

次は skill 規約であり、**CLI で強制されない。破っても機械は止めない。**

- dispatch / working / ship の stage note
- verification 無し ship request を skill 上 ship-ready とみなさないこと

`tgl dispatch` は run を台帳に載せ `run=` を印字する。stage note は要求しない。pending prevention がある session の prevention キー / `prevention: none` は CLI が強制する。
