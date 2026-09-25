# TGL gates

## 独立 review

- final / integration review は実装者と別の reviewer に依頼し、base SHA、head SHA、対象 paths、受入条件を固定する。
- auto routing を優先する。手動 reviewer を選ぶときは capability、混雑、domain 知識などの理由を記録する。
- reviewer は固定差分を read-only で確認する。対象 hash が違う、run が失敗した、結果を回収できない場合は GO と数えない。
- blocker は再現手順または path と行で示せる誤動作、安全違反、受入条件違反に限る。
- assertion が意図した性質を拘束しているかを確かめる。回帰 test は修正前の挙動で失敗する根拠を持つ。

review の依頼構文は agent-room tgl review --help を参照する。

## 指摘の処理

- 指摘ごとに owner が採用、調整、非採用を決め、根拠と解決状態を残す。
- 安定した再発防止策がある場合は次の dispatch / gate に取り込む。一般化できない事故の経緯を各 lane に複製しない。
- 修正後は変更箇所だけを再確認する。全体reviewを繰り返さない。
- 独立 review が実施されなかった場合、欠落を明記し、実施済みとして扱わない。
