---
name: graphify
description: "既に graphify-out/graph.json があるrepoで、既存graphの関連コード候補、既存graphの関連文書候補、または既存graphに既収録の利用者明示standalone SQL node間dependency候補をread-onlyで補助探索するときだけ使う。graphの新規作成・更新・clone・外部push・install・API/LLM課金には使わない。"
---

# graphify — 既存graphのread-only補助探索

このskillは、既に生成済みの `graphify-out/graph.json` を読むための限定workflowである。graphは候補発見用のcacheであり、現行source・test・SQL・docsの代わりではない。

## Trigger gate

次をすべて満たす場合だけ使う。

1. 対象repoに既存の `graphify-out/graph.json` がある。
2. `rg` 等で探索範囲を先に絞っている。
3. 求めるものが次のどちらかである。
   - 既存graphに収録されたコードnodeまたは文書nodeから関連コード・関連文書候補を広げる。
   - **既存graphに既に収録されている**利用者明示のstandalone SQL node間dependency候補を測る。

次には使わない。

- 制度・業務ルール・日本語ドメイン語彙からの探索
- docs、migration、RLS、DB関数が「存在しない」という判定
- 変更影響がない、安全である、testでcover済みという完了判定
- graphが無い、古い、空、またはtruncatedな状態からの推測

## SQL nodeの収録範囲（2026-08-24 実測）

`graphifyy[sql]` 導入後、SQLから収録されるのは `CREATE TABLE` / `VIEW` / `FUNCTION` / `PROCEDURE` / `TRIGGER` に限られる。

**`CREATE POLICY` と `ENABLE ROW LEVEL SECURITY` は収録されない。** `tree-sitter-sql` がこの構文をERROR nodeとして落とし、extractor側にも回収経路が無いため。Asunaroの `post-migrate/03_rls.sql` は1,251行・198箇所のRLS定義を持つが、graphに入るのは**ファイルnode 1個だけ**である。

したがって次を守る。

- **RLS・GRANT・権限まわりは、このskillの対象外**として扱い、必ず `.sql` を直接開いて確認する。
- テーブルnodeの近傍を見て「このテーブルに関わるものは揃った」と読まない。ポリシーは最初からgraphに存在しない。
- graphにテーブルとDB関数が入っていることは、**RLSを確認した根拠にならない**。

この欠落は警告を出さない。`extract` はRLSファイルを走査し、成功として終了する。

## Safety boundary

このskillの実行中は既存graphを**読み取るだけ**にする。次の導線は扱わない。

- `extract` / `update` / `cluster-only` / `label` / `reflect` によるgraph更新
- URLやrepoのclone、`add` / `watch` / hook / CLAUDE.md wiring
- Neo4j・FalkorDB・MCP・外部serviceへのexport / push / serve
- `pip` / `uv` 等によるgraphifyのinstall・upgrade
- Gemini等のAPI利用、semantic extraction、LLM/subagent課金
- `graphify-out/`、source tree、外部directoryへの書き込み

未収録SQLを調べるための一時extractも行わない。一時extractやgraph再生成は本read-only skillの外にある別workflowとして、対象・一時出力先・費用・破棄方法を提示し、個別承認を得て扱う。

これらを求められた場合はこのskillを終了し、別作業としてscope・費用・書き込み先・rollback・承認を確認する。graphが無ければ生成を提案して続行せず、`rg` と現行ファイルの直接確認へ戻る。

## Workflow

1. `graphify-out/graph.json` と、あれば `GRAPH_REPORT.md` の存在・mtime・sizeをread-onlyで確認する。
2. linked worktreeにgraphが無い場合は、projectで明示されたmain側graphの絶対pathだけを使う。探索して見つけた別repoのgraphを流用しない。
3. 利用可能なら2用途に該当する確定nodeだけを `graphify query` へ渡す。既知symbolの呼出関係は、まず `--context call --budget 500` の小さい範囲で試す。import関係なら `--context import` に替える。自然な日本語queryはJanome版の正式採用まで入口にしない。
   ```sh
   graphify query "<exact-symbol>" --graph "<main-root>/graphify-out/graph.json" --context call --budget 500
   ```
   `graphify path` / `graphify explain` も、関連コードnode、関連文書nodeまたは利用者明示のstandalone SQL nodeとして既に確定したnodeだけに使う。自動保存・reflection・再構築は行わない。
4. CLIが無い場合はinstallせず、`graph.json` を直接読み、候補nodeとedgeだけを抽出する。
5. 得られた候補ごとに、現行source・test・SQL・docsを直接開いて確認する。
6. graphで見つからなかったものも `rg` で再確認し、不存在の根拠にしない。

## Report

結果には次を短く示す。

- 読んだgraphのpathと鮮度
- graphが示した候補
- 現行ファイルで確認できた事実
- stale / missing / unsupportedな範囲
- graphだけでは判断していないこと

運用根拠とOJT実測は絶対SoT `~/Develop/docs/claude-commands.md` を読む。upstreamの最新状態が判断に関わる場合は、保存された版番号を信じず `~/Develop/bin/check-code-intelligence-updates` を実行する。必要な場合だけ、そこから `~/Develop/docs/superpowers/plans/2026-08-10-codegraph-graphify-operationalization.md` へ進む。旧full-pipeline手順や過去実験を現行runbookとして再利用しない。
