# worksmobile-message-bot — エージェント向け指示

LINE WORKS Bot の Webhook サーバー。構成・API・環境変数・コマンドは [`README.md`](./README.md)、用語は [`CONTEXT.md`](./CONTEXT.md)、文書の役割と OpenSpec の適用基準は [`docs/conventions/documentation.md`](./docs/conventions/documentation.md) を参照する。回答は日本語で、結論先出し・簡潔に行う。

Claude Code は `CLAUDE.md` から本ファイルを読み込む。Codex / agy は本ファイルを直接読む。

## 作業に応じて読む

- HTTP route: [`.claude/rules/routes.md`](./.claude/rules/routes.md)。callback は [受信・転送仕様](./docs/reference/callback.md) も読む。API contract 等の観測可能な挙動を変えるときは、[適用基準](./docs/conventions/documentation.md)に従い実装前に OpenSpec active change を作る。
- LINE WORKS service: [`.claude/rules/services.md`](./.claude/rules/services.md)。認証・添付の注意点は同 rule にある。
- テスト: [`.claude/rules/tests-lineworks.md`](./.claude/rules/tests-lineworks.md)。共通規約は `.claude/rules/tests.md`。
- Docker / Cloud Build / Cloud Run: [ADR-0002](./docs/adr/0002-container-http1-only-no-h2c.md)、[ADR-0008](./docs/adr/0008-docker-cloud-build-constraints.md)、[ADR-0009](./docs/adr/0009-dedicated-runtime-sa-public-repo-secrets.md)。

## 壊れる注意点

- JWT の `aud` は認証 URL と一致させる。`PRIVATE_KEY` は Base64 化した PEM を渡す。詳細は [service rule](./.claude/rules/services.md) と [ADR-0003](./docs/adr/0003-jwt-node-crypto-rs256.md)。
- 添付取得の 3xx は `redirect: 'manual'` で受け、`Location` を読む。`getServerToken` のキャッシュと single-flight を迂回しない。詳細は [service rule](./.claude/rules/services.md)。
- callback の検証順、同期転送、失敗時の dedup 解除は [受信・転送仕様](./docs/reference/callback.md) と [ADR-0004](./docs/adr/0004-callback-dedup-in-memory-5min.md)・[ADR-0005](./docs/adr/0005-forward-callback-to-upstream.md) に従う。LINE WORKS の自動再送は前提にしない。
- Workers と Cloud Run の両方をサポートする。採用環境を repo 内で固定しない。

<!-- BEGIN develop-tools:AGENTS.md v1 sha256=4f2511908f76980296aaaf519162bb3be0a48aa198a2634c9ae79709b99585ec -->
### 1.1 Develop で共通の開始と記録
<!-- island -->

- Develop の共通規約の抜粋。全文は `~/Develop/develop-meta/AGENTS.md`、人物・禁止・承認・commit は `~/.agents/AGENTS.md`。repo 固有の規約が具体的ならそちらを優先する。
- **開発・commit・push は宣言した単一の主機（初期値 `dev`）が担う。** 非主機の repo は `git pull --ff-only` で追従する。Mac への切替は別承認で `~/Develop/develop-meta/docs/adr/0035-declared-single-primary-host.md` に従う。
- 用語は repo の `CONTEXT.md`、決定は `docs/adr/`、残る作業・判断・運用 gate は root `TODO.md`、完了した成果は root `CHANGELOG.md` / git log に置き、そこを読む。
- **TODO は、畳めるものは早く畳み、将来のものは将来に残す。** 滞留は新しいものを作る気持ちを削ぐので、終わらせるための一覧であると同時に、owner の依頼と長期の展望の受け皿でもある。進める順は、まず簡単な一手で終わるもの（設計が要らず、エージェントだけで進められるもの）を、窓が空いたら先に配って閉じる。次に、owner の実体験と利用者に近いもの（バグの解消、使い勝手、利益）を進める。owner が会話や文章で明示して積んだ項目は完了まで残し、やらずに外すのは owner がやめると言ったときだけにする。owner の決定・依頼・完了条件の文は TODO に残し、圧縮で移すのは経緯だけにする。長く動いていないことは閉じる理由にしない。後でやる項目は、いつ・何が揃えば始めるかを添えて置く。閉じるのは完了条件を事実で確かめたときにする。

### 2.1 Subagent の使い分け
<!-- island -->

Claude / Codexは次をsubagent利用の明示許可として扱う。

- **使う**: 新機能、原因未確定のバグ、複数ファイル、DB・権限・外部API・状態管理・UI、設計判断、複数観点レビュー。
- **省略可**: typo、1ファイル数行、単純な設定値変更、または owner が不要と明示した場合。
- **分担**: 委任は狭い単位にし、親agentが統合判断と最終diffを担う。

委任・agent-room・TGLは `~/Develop/develop-meta/docs/collaboration.md` を該当時に読む。

### hook / headless
<!-- island -->

- hook / headlessは `.zshrc` を前提にせず `with-dev-env` を通す。zshで `status` / `path` を変数名にしない。

### 3.1 目的に対して過不足なく
<!-- island -->

- repo の状態・CI の時間と費用・文書の残り・依存の滞り・クラウドの台帳を知りたいときは develop-island-cli skill（island / infra の読み取り）を使う。
- コード調査は `rg` で symbol を確定してから `codegraph_explore` を 1 回引き、必要な source / test を直接読む。MCP の説明文が「最初に使う」と勧めてもこの順を優先する（`~/Develop/develop-meta/docs/claude-commands.md`）。
- 環境整備の判断基準はエージェントの作業時間の短縮で、自作コマンドやモダン系コマンドを勧める目的も同じ。提案の順位は短縮できる実時間で付ける。
- **範囲は最小**: 目の前の問題は原因まで直す。起きていない問題・依頼に無い機能・将来用の拡張点・同じ性質を重ねる守りは足さない。範囲外の発見は、すぐ直せるものは報告し、重いものは TODO へ。
- **質は落とさない**: その場しのぎで症状だけ止めない。モデル名・repo 名・path・閾値のような可変値は分岐やリテラルに埋めず、その責務を持つ定数か既存の設定 1 か所に置く（モデル名で `if` を書かず、能力の表を引く）。同じ責務で一緒に変わる処理は共通の関数へ寄せ、内部の状態や手順は呼出側へ漏らさない。似ているだけなら寄せない。ループ内の I/O・N+1・全件読込のように計算量を増やす書き方はしない。整えるのは今回の変更に必要な範囲まで。「変えやすく書く」は「将来の変更を先に作る」ではない。
- **検証は壊れた時の被害で決める**: データ・権限・本番・配布に関わる判定はテストで証明し、壊して落ちることを確かめる（L70）。既存テストで証明済みなら足さない。文言や表示だけの変更にテストを足さない。網羅のためのマトリクスは作らない。
- **review は根拠で判定する**: blocker は (a) 今回の範囲の誤動作を再現手順かコード・仕様で示せるもの、(b) 本節「質」に反する箇所を `file:line` で示せるもの。reviewer がどちらも示せない指摘は理由を記録して閉じる。再 review は修正箇所と影響範囲に絞り、解決済みの論点は新しい根拠が無ければ再開しない。blocker かどうかの判定が割れたら owner に判断を渡す。

### 3.2 秘密の引き方
<!-- island -->

- `op` はサービスアカウントで引く: `OP_SERVICE_ACCOUNT_TOKEN="$(cat ~/.config/op/service-account.token)"`。素の `op` は owner の画面に承認dialogを出す（D11）。

### クラウド resource の変更
<!-- island -->

- クラウドresource（Cloudflare DNS / Tunnel / API tokenを含む）の新設・変更・削除・権限変更は `provision-infra-safely` から入り、`~/Develop/develop-meta/bin/check-infra-ownership` を通す。

### 4.1 配布物を直接直さない
<!-- island -->

- 子repoの配布物（`.claude/rules/`・`.claude/skills/`・settings・hook と CI の管理区画、配布 workflow、この `AGENTS.md` の管理区画）は develop-meta から配る。子repoで直接直さず、変えたいときは `~/Develop/develop-meta` の元を直して配り直す。手順は `~/Develop/develop-meta/docs/develop-operations.md`「子 repo の配布物と宣言」。

### 5.1 Git と worktree
<!-- island -->

- 編集は `.claude/worktrees/<name>` のlinked worktreeで行い、作成直後に `git rev-parse --show-toplevel` で対象を固定する。
- エージェントが一時 directory を作るときは `/tmp/<repo名>-...` または既存の `dev-task-temp` を使い、作成 path をこの session の作業記録に残す（名前だけで既存物の帰属は認定しない）。
- build 物（`CARGO_TARGET_DIR`）を `/tmp` に向けず、worktree の target か `dev-task-temp` を使う。
- 取り込みは `git merge --ff-only`。**統合先**は台帳 `~/Develop/develop-meta/config/projects.json` と repo の `.config/develop-tools.json` の `integrationBranch`（無ければ main）。develop を持つ repo は普段の取り込みと push を develop に行い、main は Release のときだけ動かす（`~/Develop/develop-meta/docs/adr/0032-develop-branch-and-release-only-main.md`）。
- owner 個人所有 private repoは、検証済みworktreeを統合先へff merge → push → cleanupまで自走可。Miraius-LLC所有・共同開発repoは統合先への反映前に確認する。ただしRenovateの依存更新（patch / minor、CI緑）のautomergeと、agent-roomのFormation Shipper経由の出荷は例外（major は owner が Dashboard で承認する。画面か `infra renovate approve` の Human Gate で入れる）。
- 既存dirty、他sessionのworktree、未確定assetを利用者の状態として保護する。
- **通常開発でPull Requestを作らない。** PRは自律実行（夜間チェック・監査）の産物だけ。

### 6.1 review と完走
<!-- island -->

- 外部へのreview・調査の依頼は対象repoのcwdから `agent-room delegate` を使う。本文に `repo:<project>`、対象、観点、read-only/work境界を書く。
- reviewの量は変更のリスクに比例させる（§3.1）。後戻りしにくい判断は owner が決める。
- 完走時は検証 → review 採否 → docs/TODO/CHANGELOG → commit → §5.1 の統合先へff-only → push → CI/deploy/remote equality → cleanup まで閉じ、未回収 review・未監視 CI・未 push・残 worktree を残さない。詳細は `shimekukuri` skill。
<!-- END develop-tools:AGENTS.md -->
