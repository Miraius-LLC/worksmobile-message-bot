# Cloudflare Workers 主系化・Cloud Run 待機化 設計

- 日付: 2026-08-10
- 対象: `worksmobile-message-bot` / `develop-meta/infra`
- 移行目標: 2026-08-10 深夜
- 本番ドメイン: `line-works.api.miraius.co.jp`
- 状態: Task 7（Workers切替・30分監視）完了、Task 8（Cloud Run待機化）は別承認待ち

## 1. 目的

`worksmobile-message-bot` の本番実行基盤を Cloud Run から Cloudflare Workers へ移す。
移行後は GitHub の `main` push を Workers の自動デプロイ経路とし、Cloud Run は待機状態へ
移す。一方で、Docker・Cloud Build・Node/Bun entrypoint は削除せず、必要時に Cloud Run へ
手動デプロイできる状態を維持する。

## 2. 移行前ベースライン

- Hono app は `src/app.ts` に共通化済み。
- Cloud Run entrypoint は `src/index.ts`、Workers entrypoint は `src/worker.ts`。
- Worker `worksmobile-message-bot` は Cloudflare へデプロイ済み。
- Workers secrets 9 件は登録済み。
- `line-works.api.miraius.co.jp` は現在 `ghs.googlehosted.com` を向き、`/healthz` は 404。
- Cloud Build trigger は `main` push で Cloud Run を自動デプロイする設定。
- Cloud Run は `min-instances=1`、`max-instances=20`、公開 ingress で稼働中。
- GitHub Actions は CI のみで、Workers deploy job と Cloudflare credential は未設定。

### 2.1 Task 7実績（2026-08-10）

- Cloud Build triggerをdisabledにし、`main` commit `42ae313`のCIとWorkers deployを完了した。
- 初回deployは既存の外部管理CNAMEとの競合（Cloudflare code `100117`）で停止した。
- fallback profileと完全一致したCNAME 1件だけを削除し、failed jobの再実行（run
  `31391499733`、attempt 2）でCustom Domain登録に成功した。
- Cloudflare公開DNS、TLS、`/healthz` 200、未認証route 401、501 self送信と`/status` callback往復を
  実測し、30分超の監視を正常終了した。Cloud Runは公開状態を維持し、Task 8の別承認を待つ。

## 3. 採用方式

### 3.1 主系と待機系

| 項目 | Cloudflare Workers | Cloud Run |
|---|---|---|
| 役割 | 本番主系 | 手動復旧用の待機系 |
| 通常デプロイ | `main` push 後の GitHub Actions | 自動デプロイしない |
| 公開ドメイン | `line-works.api.miraius.co.jp` | 公開 ingress を閉じる |
| スケーリング | Workers 標準 | `min-instances=0`、`max-instances=1` |
| 構成の SoT | `wrangler.jsonc` | `cloudbuild.yaml` / `Dockerfile` |

Cloud Run には停止状態がないため、`min-instances=0` と外部 ingress 無効化を「待機状態」と
定義する。待機インスタンスの計算料金は発生しないが、Artifact Registry のイメージ保存など、
再デプロイ経路を残すための小額なストレージ料金は対象外とする。

### 3.2 GitHub Actions

`main` push では既存 `.github/workflows/ci.yml` の `check` job 成功後に、同じ workflow 内の
`deploy` job を実行する。deploy の `actions/checkout` / `oven-sh/setup-bun` /
`cloudflare/wrangler-action` は全て commit SHA で固定し、
GitHub Secret `CLOUDFLARE_API_TOKEN` と GitHub Variable `CLOUDFLARE_ACCOUNT_ID` を渡す。

deploy workflow は次を満たす。

1. `main` push と手動 `workflow_dispatch` を受け付ける。
2. `deploy` job は `needs: check` と `github.ref == 'refs/heads/main'` を要求し、CI が成功した
   `main` commit だけをデプロイする。
3. `bun install --frozen-lockfile` 後に `wrangler deploy` を実行する。
4. deploy 結果から version と deployment URL を GitHub Actions に残す。
5. deploy job は専用 concurrency group と `cancel-in-progress: true` を使い、常に最新 commit を
   最終状態にする。

Cloud Run の Cloud Build trigger は無効化し、次の push で Cloud Run が自動復帰する事故を
防ぐ。`cloudbuild.yaml` は手動実行時に待機設定を公開設定へ戻せる既存構成のまま残す。
手動実行では trigger 専用の `REPO_NAME` / `COMMIT_SHA` / `SHORT_SHA` を git から
実測し、`_CLIENT_ID` / `_SERVICE_ACCOUNT_LW` / `_BOT_ID` は `secrets:inject` で生成した
`.env` から値を表示せず substitution へ渡す。実値は shell history や build log へ出さないが、
Cloud Build の build metadata には保持される低機密値として扱う。

## 4. Custom Domain と DNS

`wrangler.jsonc` に次の Custom Domain を宣言する。

```jsonc
"routes": [
  {
    "pattern": "line-works.api.miraius.co.jp",
    "custom_domain": true,
  },
]
```

Custom Domain は Worker と hostname の対応を `wrangler.jsonc` の deploy 設定として管理する。
既存の Cloud Run 向け CNAME は `ghs.googlehosted.com`、TTL は `1`（Cloudflare Auto）である。
`docs/operations/cloud-run-dns-fallback.json`を2026-08-10のlive DNS API実測値の永続fallback
profileとし、切替直前の live recordと完全一致することを確認する。不一致なら
停止し、profileを自動または手動で勝手に上書きしない。Wrangler 4.120.0の実測では、外部管理の
既存CNAMEがある状態のCustom Domain deployはCloudflare code `100117`で停止し、自動置換しない。
承認された切替窓で、profileと完全一致するCNAME 1件だけを削除してdeployを再実行する。
失敗時はprofileから即時復元する。通常の DNS record と Custom Domain record をTerraformから
二重管理しない。

Wrangler 4.120.0 bundled workerd対応上限の実測により、`wrangler.jsonc`の`compatibility_date`は`2026-08-08`へ固定する。移行目標日のメタ日付（2026-08-10）は変更しない。

`develop-meta/infra` は次の責務を持つ。

- `infra/registry/worksmobile-message-bot.yaml` に Cloudflare account、Worker、Custom Domain、
  deploy token、zone を記録する。
- `provision-cf-api-token --kind=workers-script-deploy` で account の `Workers Scripts Write` と
  `miraius.co.jp` zone の `Workers Routes Write` / `DNS Write` / `Zone Read` に限定した token を
  発行し、1Password へ値を表示せず保存する。`D1 Write` と `Workers R2 Storage Read` は付与しない。
- Workers Domains APIのList/Detach権限は公式仕様どおり`Workers Scripts Write`で担保する。
  `Workers Routes Write`はzone route用であり、Custom Domain管理権限の根拠にはしない。
  2026-08-10に現行tokenのList Domainsが`success=true`となることをlive確認した。
- `check-infra-ownership` と registry doctor で台帳と実物の drift を検出する。

Terraform の `miraius.co.jp/cloudflare-dns` stack は、Custom Domain 自動生成 record を管理対象に
追加しない。既存の `site.miraius.co.jp` record と state を変更しない。

## 5. 移行手順

### 5.1 事前準備

1. アプリ repo の worktree で workflow、Wrangler config、tests、docs を変更する。
2. develop-meta の worktree で infra registry と生成 docs を更新する。
3. infra provisioner から zone 限定 Workers deploy token を発行する。
4. token を GitHub Secret、account ID を GitHub Variable に登録する。
5. `wrangler deploy --dry-run`、全テスト、設定テスト、infra doctor を通す。
6. 501 で `bun test tests/callback/route.test.ts src/services/lineworks/callback/dedup.test.ts` を
   実行し、同一 callback の2回目が副作用なしで skip されることを確認する。
7. Cloud Build trigger を無効化し、`main` 反映と同時に Cloud Run deploy が走らない状態にする。
   この時点では Cloud Run 本体と既存 CNAME は変更せず、Workers deploy が失敗しても現行経路を
   維持する。

### 5.2 切替

1. Worker の既存 deployment と secrets 9 件を再確認する。
2. 既存 CNAME が永続fallback profileと完全一致することを確認し、record IDを内部変数に保持する。
3. 承認された切替窓でそのCNAME 1件だけを削除し、`main` のCI成功後にWorkers deployを実行する。
   deploy失敗時は直ちにfallback profileを復元する。
4. Custom Domain の certificate と DNS activation を最大 10 分待つ。
5. `https://line-works.api.miraius.co.jp/healthz` が 200 を返すことを確認する。
6. BASIC 認証なしの保護対象 request が 401、正しい認証付き request が期待応答になることを
   確認する。
7. LINE WORKS Callback URL は hostname を変えないため設定値を変更しない。藤井が self channel
   から `/status` を 1 件送信し、Workers での受信、501 への転送、応答 1 件、重複応答なしを
   確認する。
8. GitHub Actions の deploy commit と Workers production version が一致することを確認する。
9. 30 分間の監視を開始する。この間は Cloud Run を公開状態のまま残す。

Custom Domain が 10 分以内に active にならない、TLS error が継続する、`/healthz` が 200 に
ならない、BASIC 認証または Callback の代表検証に失敗する、のいずれかで NO-GO とする。
NO-GO 時は Cloud Run 待機化へ進まず、既存 CNAME をスナップショットどおり復元する。

### 5.3 Cloud Run 待機化

Workers の切替確認後に、別の本番操作ゲートとして次を行う。

1. 30 分監視が正常終了したことを確認する。
2. Cloud Run を `min-instances=0`、`max-instances=1` に更新する。
3. Cloud Run の ingress を内部限定へ変更する。
4. Custom Domain が Workers を向いていることと、Cloud Run の公開 URL が外部から利用できない
   ことを確認する。
5. 待機化後 10 分間、Workers logs、Callback、エラー率を監視し、Cloud Run が 0 instance の
   ままかを確認する。

翌日、24 時間分の Workers logs と Cloud Run instance 数を再確認する。これは移行後の
フォローアップであり、深夜切替の完了条件には含めない。

## 6. ロールバック

切替後に重大障害が起きた場合は、次の順で戻す。

1. 単純な Worker regression なら `wrangler rollback <version-id>` で直前 version へ戻す。
2. Workers 基盤・Custom Domain の障害なら、既存 image のまま次を実行し、再ビルドせず
   Cloud Run を公開状態へ戻す。

   ```sh
   gcloud run services update worksmobile-message-bot \
     --region=asia-northeast1 \
     --ingress=all \
     --min-instances=1 \
     --max-instances=20
   ```

3. `line-works.api.miraius.co.jp` の Custom Domain record を解除し、永続fallback profileの
   `CNAME ghs.googlehosted.com`（TTL `1` = Auto、proxied false）を復元する。解除は Workers Domains API
   で hostname に一致する domain ID を取得してから行い、IDを推測しない。
   解除後のDNS recordが0件ならprofileからPOST、1件ならprofile完全一致時のみno-opとし、
   1件不一致または2件以上は停止する。想定外recordをPATCHで上書きしない。
4. Cloud Run default URLは既存revisionでも利用できる`/health`、本番hostnameは`/healthz`を使い、
   BASIC 認証、Callback 転送も確認してからロールバック完了とする。

DNS は権威 DNS が同じ Cloudflare 内でもキャッシュの影響を受けるため、復元後最大 10 分を
回復待ち時間として扱う。10 分を超えて Cloud Run へ戻らなければ Cloudflare DNS と Cloud Run
domain mapping を再確認する。

Cloud Run service と Cloud Run domain mapping は今回削除しないため、ロールバック時に新規作成を
必要としない。

## 7. エラー処理と安全策

- CI が失敗した commit はデプロイしない。
- GitHub deploy token は account 全体ではなく対象 account と `miraius.co.jp` zone に限定する。
- token 値、Workers secrets、1Password の値をログや設計書へ出さない。
- Cloudflare/GCP access tokenはshell local変数からstdinのcurl configへのみ渡し、
  子processのargv/environmentに展開しない。
- DNS 切替前に既存 record の type、content、record ID を読み取り、推測で削除しない。
- CNAME削除はlive recordがfallback profileと完全一致する1件の場合に限り、承認された切替窓で
  実行する。deploy失敗時は同profileから即時復元する。
- Cloud Build trigger は切替前に無効化し、Cloud Run 待機化は Workers の本番疎通後に実行する。
- callback dedup は isolate 間で共有されないため、移行時点では 501 側 dedup を最終防衛線とする。
- Workers deploy と Cloud Run 復旧操作を同時に行わない。

## 8. 検証

### 静的・自動検証

- `bunx tsc --noEmit`
- `bunx biome check ./src ./tests ./scripts ci-config.test.ts wrangler-config.test.ts operations-config.test.ts`
- `bun test`
- `bunx wrangler deploy --dry-run`
- `wrangler-config.test.ts` で Worker name、entrypoint、compatibility、Custom Domain を固定する。
- `operations-config.test.ts`でfallback profileと`.gcloudignore`のenv upload除外を固定する。
- GitHub Actions を actionlint で検査する。
- production deploy job の `checkout` / `setup-bun` / `wrangler-action` を全て 40 桁 commit SHA へ固定する。
- `check-infra-ownership`、registry schema test、registry doctor を実行する。

### 本番検証

- Workers deployment status と GitHub Actions commit の一致
- Custom Domain の DNS、TLS、HTTP 200
- 公開 path、BASIC 認証 path、Callback の代表検証
- 501 転送の成功と二重処理がないこと
- Cloud Run min instance 0 と外部 ingress 閉鎖
- Cloud Build trigger disabled

## 9. 変更対象と規模

### `worksmobile-message-bot`

- `.github/workflows/ci.yml`
- `wrangler.jsonc`
- `wrangler-config.test.ts`
- `README.md`
- `docs/adr/0010-cloudflare-workers-primary-cloud-run-standby.md` 新設
- `docs/adr/README.md`
- `TODO.md` / `CHANGELOG.md` は実装完了時に同期
- 目安: 150〜250 行

### `develop-meta/infra`

- `infra/registry/worksmobile-message-bot.yaml`
- registry 由来の生成 docs / `CHANGELOG.md`
- 目安: 30〜60 行

## 10. 完了条件

- `main` push から Workers への自動デプロイが成功する。
- `line-works.api.miraius.co.jp` が Workers を配信し、主要経路が正常に動く。
- Cloud Run は scale-to-zero・外部 ingress 閉鎖、Cloud Build trigger は disabled である。
- Cloud Run 用コードと手動デプロイ経路が残り、ロールバック手順が実行可能である。
- infra registry、README、ADR、TODO、CHANGELOG と実状態が一致する。
- commit / push、GitHub Actions / Workers deploy 監視、remote equality、worktree cleanup まで完了する。
