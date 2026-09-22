# Formation review 手順

repo 内外の成果を固定して静的 review に出し、依頼 lane の実走証跡と合わせて回収する。

## 背景と適用範囲

[2026-09-12 kaizen の記録（固定 commit の TODO）](https://github.com/fujimogn/agent-room/blob/57332771753259a42b4759545e391e6b45e795e6/TODO.md#L44-L45) は、`fm_mise_gates_20260913` で次の失敗を記録している。

- Codex が run の repo 外を読めず、6 回判定不能になった。
- 添付は 503、成果本文の inline 貼付は 4000 byte 上限に当たった。
- read-only reviewer の test 実走が成立せず、Codex は mode work でも `/tmp` と worktree 内への書込み、`mktemp` に失敗した。実走は Claude 1 本に依存した。

これは当時の実事例であり、全 agent の現在の権限を断定するものではない。この制約下では、成果本文を送らず「絶対 path + sha256 + 観点」で静的 review を依頼し、実走は依頼 lane が担う。

## 成果の固定と静的 review

1. 対象 repo の自分の worktree から依頼する。repo 外の contract / progress / dossier も対象ファイルを絞り、実在する絶対 path と `sha256sum <絶対path>` の値を取得する。`~` や相対 path、推測した hash は渡さない。
2. repo 内の変更なら base/head SHA、対象 path、clean/dirty 状態も固定する。repo 外成果には Git range を捏造せず、ファイルごとの hash を版の識別に使う。
3. 本文には絶対 path、sha256、受入条件・観点・禁止事項だけを簡潔に書く。成果の添付（`--file` / `--image` / `--diff`）と成果本文の inline 貼付は使わない。依頼文も 4000 byte 未満に収める。
4. reviewer は読めた対象の sha256 を照合してから静的に判断する。読取不可・hash 不一致は **判定不能**。path を渡しただけでは repo 外の読取制限は解消しない。読めなかった成果を承認しない。
5. 判定不能なら、同じ制限下で添付・inline・権限変更を繰り返さず、その絶対 path を読める別 reviewer へ同じ固定対象を依頼する。利用可能な reviewer がいなければ BLOCKED を報告する。
6. reviewer には test、`mktemp`、書込み、commit、live 操作を求めない。結果は GO / NO-GO / 判定不能、対象と hash の一致、指摘の根拠を回収する。review 中に対象が変わったら新しい hash で再依頼し、旧判定を流用しない。

## 証跡 2 本の数え方

| 証跡 | 担当 | 必須の記録 |
|---|---|---|
| 1. 独立した静的 review | 実装者と別の agent | run ID、読取・hash 一致、固定対象、判定、指摘と根拠 |
| 2. 実走検証 | 静的 reviewer と別の agent。通常は依頼側の実装 lane | 同じ head SHA・成果 hash、`bun run check`、exit code、ログの path |

この Formation 契約では「独立した静的 review + 依頼 lane の実走」を証跡 2 本と数える。**独立 reviewer 2 人の承認を得たという意味ではない**。別途 2 人の独立承認が指定されていれば、その条件を満たすまで足りない。

- read-only reviewer に実走を要求しない。実走できなかった review を test 成功として数えない。同じ review の再送も本数を増やさない。
- 依頼 lane は対応する worktree で `bun run check` を実走する。repo 外文書の意味・妥当性までこの command が検証したとは扱わず、その部分は静的 review の対象にする。
- review の指摘を依頼 lane が採否判断し、必要な修正・再検証・再reviewを済ませる。CANDIDATE_READY には固定 commit、実走ログ、review run ID / 記録を添える。配送未確認と review 未完了を混同しない。

## `delegate --blind` 依頼テンプレ

対象 repo の cwd で以下を実行する。placeholder を観測値で埋め、本文は日本語・4000 byte 未満。`--text-file -` は依頼文を stdin で渡す指定で、成果の添付ではない。

```sh
agent-room delegate --from <依頼agent> --to <独立reviewer> --blind --mode read-only --text-file - <<'REVIEW'
repo:<allowlist上のrepo名>

静的 review をお願いします。
対象: <成果の絶対path>
sha256: <そのファイルで取得した64桁hash>
固定版: <repo内ならbase/head SHAとclean/dirty、repo外なら上のhash>
観点: <受入条件と重点確認点>
境界: 対象を読んでhashを照合。読取不可・不一致なら判定不能。添付・本文転記・test・mktemp・書込み・commit・live操作は禁止。
実走: <依頼laneのagent、head SHA、bun run checkのexit code、ログpath>
返答: GO / NO-GO / 判定不能、読取とhash一致、指摘と根拠。実走は依頼laneの別証跡として扱う。
REVIEW
```

複数ファイルなら対象と sha256 の組を繰り返す。返された run ID を保持し、`agent-room watch --run <run-id>` / `agent-room run <run-id>` で終端結果を回収する。受付・queued・processing は review 完了ではない。
