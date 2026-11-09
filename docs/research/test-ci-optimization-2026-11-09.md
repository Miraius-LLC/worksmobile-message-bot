# テストと CI の実測・最適化候補（2026-11-09）

## 結論

develop CI は直近 20 秒、手元の全テストは 43 ファイル・634 件で 610 ms。テストの分割より、develop CI の `common` job で 7 秒かかった actionlint の実行条件を調整する方が短縮余地がある。ただし並列の `bun` job は 10 秒なので、この run 全体の短縮は単純計算で約 6 秒が上限である。実装前に変更範囲判定と同条件の Actions run で効果を確かめる。ルート直下のテスト 7 本は別 assignment で移動するため、本調査では src・テスト・CI を変更しない。

計測基点は `git fetch origin develop` 後の `origin/develop` = `bfb71add747d9213e465b69b7f7379b1eb1c85ef`。以下の CI とローカルの時間は測定環境が異なるため合算しない。main の履歴値は現在の develop 設定の所要時間とはみなさない。

## 現状と再現コマンド

| 対象 | コマンド・母数 | 結果 |
| --- | --- | --- |
| CI (develop) | `island measure ci --repo worksmobile-message-bot --json --detail`、成功 5 run | 最新 run 20 秒、中央値 19 秒。最新 job は `common` 16 秒、`bun` 10 秒（並列、job 合計 26 秒）。最新は [run 42609765366](https://github.com/Miraius-LLC/worksmobile-message-bot/actions/runs/42609765366)、2026-11-09 11:31:50 UTC。`common` の actionlint step 7 秒、gitleaks 1 秒、docs 0 秒。`bun` の install 2 秒、lint 0 秒、typecheck 0 秒、`test:fast` 1 秒。秒単位丸め。 |
| main CI | `gh run list --workflow ci.yml --branch main --limit 5 --json ...`、`gh run view 39916028306 --json jobs,...` | 最新成功は 2026-10-23 の [run 39916028306](https://github.com/Miraius-LLC/worksmobile-message-bot/actions/runs/39916028306)。`check` 18 秒（07:10:04–22 UTC）、依存する `deploy` 16 秒（07:10:24–40 UTC）。当時の main commit の履歴値。 |
| Develop tools | `gh run list --workflow develop-tools.yml --branch main --limit 5 --json ...`、`gh run view 39916028297 --json jobs,...` | 最新成功は 2026-10-23 の [run 39916028297](https://github.com/Miraius-LLC/worksmobile-message-bot/actions/runs/39916028297)。`smoke` 6 秒（07:10:04–10 UTC）。これも旧 main の値。 |
| 全テスト | `bun test`、終了 0 | 634 pass / 0 fail、43 ファイル、Bun 報告 610 ms。 |
| 軽量テスト | `bun run test:fast`、終了 0 | 622 pass / 0 fail、42 ファイル、Bun 報告 309 ms。差は `_fetch.test.ts` の 12 件・1 ファイル。 |
| 遅いファイル | `rg --files -g '*.test.ts'` の 43 件を各 `bun test <file>` で独立実行し、Python の `time.monotonic()` で計時 | 上位は `src/services/lineworks/_fetch.test.ts` 153 ms（12件）、`tests/routes/bots.test.ts` 85 ms（26件）、`tests/routes/callback.test.ts` 84 ms（36件）、`tests/routes/menus/rich.test.ts` 83 ms（37件）、`tests/routes/channels.test.ts` 72 ms（16件）。43 件とも終了 0。個別実行は毎回 Bun 起動を含み、全体 610 ms と加算比較できない。 |

`island measure ci` は既定ブランチ上の成功 run に絞るため、`CI` と `Develop tools` は `no successful runs on default branch`、各 sample 0 と表示した。上の main 値は別途 `gh run view` から取得した履歴値である。現行設定では develop / PR は `common`（actionlint、gitleaks、変更文書）と `bun`（install、lint、型、`test:fast`）が並列で走る（`.github/workflows/ci-develop.yml:6-60`, `:108-118`）。main は check で OpenSpec strict validation・全テスト・Wrangler dry-run を行い、成功後だけ deploy する（`.github/workflows/ci.yml:70-96`）。`Develop tools` は main のみで道具と文書検査をする（`.github/workflows/develop-tools.yml:3-31`）。

`test:fast` が除く `_fetch.test.ts` は実 timer の timeout / abort / stream / URL 秘匿を含む（`src/services/lineworks/_fetch.test.ts:40-212`）。全テストには残り、main の `bun test` で走る（`package.json:25-36`, `.github/workflows/ci.yml:79-80`）。現在の除外は 12 件に限定されており、広げる理由は見つからなかった。

ルート直下の 7 本は役割が異なる。`ci-config.test.ts` は CI gate と deploy 条件（`:27-141`）、`ci-install.test.ts` は install script の隔離実行（`:15-65`）、`lockfile-config.test.ts` は lockfile、`wrangler-config.test.ts` は Worker 設定（`:12-22`）、`operations-config.test.ts` は公開 repo / deploy 文書（`:4-127`）、`openspec-config.test.ts` は OpenSpec と CI 分担（`:9-89`）、`openspec-adr-coverage.test.ts` は ADR と spec の双方向リンク（`:19-71`）。`ci-config.test.ts:133-135` と `openspec-config.test.ts:54` は main の `bun run lint` 呼び出しを部分的に重複確認する。後者は OpenSpec strict validation と pre-push の分担も守るため統合しない。ルート test は `bun test` と lint 対象だが、pre-commit の test glob は `{src,tests}/**` で拾わない（`.config/lefthook.yml:104-108`, `package.json:28`）。移動 assignment で配置変更後、対象 glob と import 相対 path を確認する。

hook は pre-commit で staged docs、gitleaks、対象 TS の Biome・型検査と関連 test を実行し、pre-push は `check-release-version` だけ（`.config/lefthook.yml:50-115`, `.lefthook/pre-push/check-release-version.sh:1-4`）。全テストと OpenSpec は main CI が持つ。この分担を維持する。

## 提案（短縮できる実時間の大きい順）

1. **develop の actionlint 実行条件を小さくする候補を測る。** 最新 run で 7 秒、`common` job 16 秒のうち記録された最長 step。並列の `bun` job が 10 秒なので、run 全体の短縮上限は約 6 秒。`.github/**` の変更を含まない push / PR だけ省略し、`.github/**` を変更した push / PR と main では必ず実行する案。変更対象は配布元の ci-develop 生成テンプレートと、この repo の `.github/workflows/ci-develop.yml:28`（生成結果。直接編集しない）。差分抽出は push の before..head、PR の merge-base..head、初回 push / 比較不能時は実行、という fail-closed 条件が必要。既存の actionlint gate を対象変更時に維持できることをテストで確認し、同条件の Actions run で実際の短縮量を再計測する。社内の別 repo でも actionlint は無条件実行であり、完成済みの短縮策を転用する提案ではない。
2. **`test:fast` の除外を現状の 1 ファイルに保つ。** 手元では全体 610 ms に対して 309 ms、約 301 ms の差。ただし別実行の差で、CI 短縮の推定には使わない。変更ファイルなし（維持する設定は `package.json:25-36`）。12 件は main 全テストで守られる。社内の別 repo では codegen 完了後に test と build を並列化し、長時間の suite は複数 job に分けている。本 repo の 610 ms の suite にはその管理を導入しない。
3. **7 本の移動後に pre-commit の捕捉範囲を確かめる。** 短縮効果は 0 秒（品質の抜けを閉じる項目）。移動担当の変更対象はルートの 7 本と新配置、必要なら `package.json:28` の lint path、`.config/lefthook.yml:97-108` の glob。移動前に hook を広げると root test の変更でも関連 test が走るが、先行 assignment の成果と衝突するため提案しない。社内の別 repo では Bun と Vitest の matcher を接尾辞で分け、二重実行を防いでいる。移動後も Bun の 7 本が全件検出されることと pre-commit の関連 test が呼ばれることを検証する。

社内の別 repo は時間表と手動の test 分割を持つ。本 repo は最遅ファイルが 153 ms、全体が 610 ms のため、同じ時間表・shard 管理のコストが短縮見込みを上回る。現時点では導入しない。
