## Callback本文サイズ制限

- [x] 1.1 一次情報を確認し、公式最大値未記載のため独自上限1MiBを司令塔へ相談して承認を得る
- [x] 1.2 active changeを作成し、`bun run spec:validate`を通す
- [x] 1.3 本文超過streamを最後まで読まず413にするHTTPテストを追加し、修正前のREDを確認する（30 pass / 1 fail、期待413に対し401）
- [x] 1.4 callback routeにbyte数の実測と上限超過時の中断を実装しGREENにする
- [x] 1.5 過少Content-Length、上限ちょうどのUTF-8本文、byte数超過を検証し、READMEとCHANGELOGを更新する
- [x] 1.6 spec:validate（10 pass）、全体test（614 pass）、typecheck、biomeを通す

commit後の固定差分を独立reviewし、GO run IDをFormationの候補報告へ記録する。
