# LINE WORKS API 更新以外で進められる作業（2026-11-09）

## 調査範囲と結論

起点は `origin/develop` の `ca8cfe0`。`TODO.md`、未 archive の `openspec/changes/`、README のエンドポイント仕様と `src/routes/`、AGENTS.md・ADR と実装を読み、指定の検査を実行した。現時点で進められるのは完了済み change の整理と、確認できた文書のずれの修正である。LINE WORKS API の新しい仕様への追従や未発生の信頼性拡張は、この一覧に含めない。

## すぐ直せる

| 項目 | 根拠と次の一手 |
| --- | --- |
| 完了済み OpenSpec change `lineworks-b1-b2` を archive する | `openspec/changes/lineworks-b1-b2/tasks.md:3-5` は全 3 タスクが完了。対応実装は `89dce68`（image/video の排他）と `30aa37b`（timeout URL の機微要素除去）として `origin/develop` に含まれる。現行仕様への取り込みを確認して archive する。archive は正本の `openspec/specs/` も更新するため、この調査 lane では実施しない。 |
| ADR-0008 の Bun バージョン管理の記述を現況に合わせる | `docs/adr/0008-docker-cloud-build-constraints.md:48` は Dockerfile の `FROM` 2 行と `.tool-versions` を版の固定箇所とするが、実体は `Dockerfile:14,17,31` の `ARG BUN_VERSION=1.4.4` と `.config/mise.toml:2`。`AGENTS.md:48` も後者を指定する。SHA-256 固定の Original Record は保存し、その外側に現況を注記する（同 ADR `:37-48`）。 |
| ADR-0003・AGENTS.md・service rule の秘密鍵記述を直す | `docs/adr/0003-jwt-node-crypto-rs256.md:48` と `.claude/rules/services.md:38` は存在しない `getPrivateKey` で decode すると記す。実体は `src/utils/config.ts:33,92-99` の config load 時の decode・検証である。さらに `AGENTS.md:29` と同 ADR `:48` の「生 PEM は JWT 署名で失敗」は、実際には Base64 decode で先に失敗する（`config.ts:34,93`。Bun 1.4.4 で生 PEM ヘッダーを `atob` に渡すと `InvalidCharacterError` を確認）。ADR は SHA-256 固定の Original Record の外側に現況を注記する（同 ADR `:37-48`）。`.claude/rules/.distributed:1-2` に `services.md` はなく、repo 固有の rule としてこの repo で直す。 |
| repo 固有の route・service rule の旧記述を直す | `.claude/rules/routes.md:8,21,29,31,36` は mount 先を `src/index.ts` と記し、存在しない `messageSenders` を案内する。実体は `src/app.ts:79-80` の mount と `src/services/lineworks/messages/index.ts:381-400` の `messageSchemas`。`.claude/rules/services.md:32` の route handler による `reply.code(500)` も `src/app.ts:90-107` の `app.onError` と異なる。両 rule は `.claude/rules/.distributed:1-2` の配布対象外なので repo で修正できる。 |
| README の検証時点と表記を直す | `README.md:525` は各メッセージ本文を「起動時」に検証すると記すが、`src/routes/messages.ts:26-33` の `zValidator('json', ...)` は各リクエストを検証する。`README.md:386` の「フレキシブルステンプレート」も誤記。API contract を変えず説明だけ修正する。 |

## 要設計

該当なし。今回確認した範囲で、既に発生していて設計を始めるべき問題は見つからなかった。

## owner 判断

| 項目 | 根拠と必要な判断 |
| --- | --- |
| JWT 秘密鍵 decode の時点について仕様と実装のどちらを正とするか | `openspec/specs/lineworks-jwt-authentication/spec.md:31` は起動時 validation 後に「署名直前で」decode することを SHALL とする。一方、`src/utils/config.ts:92-99` は config load 時に decode し、`src/services/lineworks/auth.ts:44-46` は decode 済み PEM を署名に使う。有効な鍵の署名結果については差を確認できない。不正な鍵では Cloud Run が `src/index.ts:13` で起動時に config を読み、Workers は `src/worker.ts:8-10` で初回 request の処理時に読むため、失敗時点に外から観測できる差がある（コードからの見立て、実機未検証）。これは spec の起動時 fail-fast scenario（同 spec `:37-41`）とも一致しない。仕様を変えるか実装を変えるかは owner 判断待ちとし、この調査では決めない。 |

将来の着手条件は次節に分けて記す。

## TODO の将来条件

| 項目 | 着手条件の確認 |
| --- | --- |
| Durable Queue | `TODO.md:14` と `docs/adr/0005-forward-callback-to-upstream.md:30,36` は、転送先障害時にもイベントを確実に滞留・再処理する厳密な非消失保証が必要になった場合に検討すると定める。現行は同期転送、失敗時 500・ログ・手動再投入用の dedup 解除（`src/routes/callback.ts:121-125`）。この repo の調査対象に保証要求が発生した証拠はなく、着手条件は未確認。 |
| dedup 共有ストア | `TODO.md:15` と `docs/adr/0004-callback-dedup-in-memory-5min.md:30,35-36` は gateway 単体で厳密な一回処理が必要な場合に限る。現行は in-memory Map による 5 分の best effort（`src/services/lineworks/callback/dedup.ts:3,11,36-42`）。厳密性の要求が発生した証拠はなく、着手条件は未確認。 |

## 観点別の確認結果

- `TODO.md` の「次に着手」は空（`TODO.md:9-12`）。今進められる未完了機能は該当なし。
- 未 archive の change は `openspec/changes/lineworks-b1-b2/` だけで、タスクは完了済み（同 `tasks.md:3-5`）。
- README のエンドポイント表（`README.md:364-519`）は `src/app.ts:72-86` の mount、`src/routes/messages.ts:24-46` の型別 route、および `src/routes/attachments/index.ts:15-27`、`src/routes/menus/`、`src/routes/channels.ts`、`src/routes/domains.ts`、`src/routes/bots.ts` の HTTP method・path と照合した。エンドポイントの欠落・余分な route は該当なし。説明文のずれは上表のとおり。
- AGENTS.md の JWT、鍵、token cache、BASIC 認証、callback、二基盤起動に関する記述は対応する `src/services/lineworks/auth.ts:8-21,39,98-118`、`src/utils/config.ts:33-34,92-99`、`src/app.ts:23-29,67-86,90-107`、`src/routes/callback.ts:60-125`、`src/index.ts`、`src/worker.ts` と照合した。ずれは上表の `AGENTS.md:29` にある。ADR の現況とのずれは上表の ADR-0003 と ADR-0008 を確認した。

## 検査

| コマンド | 結果 |
| --- | --- |
| `bun run typecheck` | exit 0。`bun --check` が 79 ファイルを検査し、型エラー 0。 |
| `bun test` | exit 0。43 ファイルの 634 テストが pass、fail 0、`expect()` 1267 回。 |

検査不能の項目は該当なし。検査は専用 worktree の `ca8cfe0` 上で実行した。
