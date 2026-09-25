# TGL lanes

## 分割するか決める

TGL は、独立に実装・検証できる意味のある複数 slice があり、並行化が調整コストを上回る場合に使う。単一の小変更、密結合の編集、所有者を分けられない作業は lane に分けない。

Director は実装前に lane ごとの owner、目的、許可 paths、受入条件、依存、worktree を決める。割当には上限と完了条件を書く。片側だけでは完成しない接続・配線も、明示した lane の受入条件に含める。

## Lane の責任

- 1 lane が1つの明確な成果と path 群を所有する。重複編集を避け、scope 追加は Director が再割当する。
- 契約境界を共有する複数 lane は、各自の受入条件に境界確認を含める。統合担当は接続全体を別途確認する。
- 最新の指定 base から専用 worktree を使い、他 lane の checkout / branch を変更しない。
- 実装 lane は状態、根拠、blocker を報告する。待ち・未開始・停止を done と判断しない。
- 新しい lane を割り当てる前に、同じ member の前の CANDIDATE_READY を ACK する。

## 分割の形

| 形 | 向く仕事 |
|---|---|
| 機能 slice | UI・domain・API の独立した受入可能な振る舞い |
| test / integration | 既存境界を守る回帰 test、または完成 slice 同士の結線 |
| 調査 / design | 実装前に選択肢と根拠を短い成果物へまとめる |
| UI smoke | 実装を持たない独立 lane が、決めた journey と regression を検証する |

UI smoke は、実装中に起動条件を整え、auth / 主経路 / regression を受入条件に結び付ける。観測した画面、操作、結果を evidence に記録し、実装 lane の自己確認だけを独立 gate と数えない。

lane の dispatch、再開、完了 evidence は [TGL evidence](https://github.com/fujimogn/agent-room/blob/main/skills/tgl/references/evidence.md) を参照する。CLI syntax は agent-room tgl <action> --help で確認する。
