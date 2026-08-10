# Cloudflare Workers 主系化・Cloud Run 待機化 設計

- 日付: 2026-08-10
- 対象: `worksmobile-message-bot` / `develop-meta/infra`
- 移行目標: 2026-08-10 深夜
- 本番ドメイン: `line-works.api.miraius.co.jp`

## 1. 目的

`worksmobile-message-bot` の本番実行基盤を Cloud Run から Cloudflare Workers へ移す。
移行後は GitHub の `main` push を Workers の自動デプロイ経路とし、Cloud Run は待機状態へ
移す。一方で、Docker・Cloud Build・Node/Bun entrypoint は削除せず、必要時に Cloud Run へ
手動デプロイできる状態を維持する。

## 2. 現状

- Hono app は `src/app.ts` に共通化済み。
- Cloud Run entrypoint は `src/index.ts`、Workers entrypoint は `src/worker.ts`。
- Worker `worksmobile-message-bot` は Cloudflare へデプロイ済み。
- Workers secrets 9 件は登録済み。
- `line-works.api.miraius.co.jp` は現在 `ghs.googlehosted.com` を向き、`/healthz` は 404。
- Cloud Build trigger は `main` push で Cloud Run を自動デプロイする設定。
- Cloud Run は `min-instances=1`、`max-instances=20`、公開 ingress で稼働中。
- GitHub Actions は CI のみで、Workers deploy job と Cloudflare credential は未設定。

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

`main` push では既存 CI の成功後に Workers deploy workflow を実行する。deploy は
`cloudflare/wrangler-action` を用い、GitHub Secret `CLOUDFLARE_API_TOKEN` と GitHub Variable
`CLOUDFLARE_ACCOUNT_ID` を渡す。

deploy workflow は次を満たす。

1. `main` push と手動 `workflow_dispatch` を受け付ける。
2. CI workflow が成功した commit だけをデプロイする。
3. `bun install --frozen-lockfile` 後に `wrangler deploy` を実行する。
4. deploy 結果から version と deployment URL を GitHub Actions に残す。
5. 同時 deploy は concurrency group で直列化し、古い実行を cancel しない。

Cloud Run の Cloud Build trigger は無効化し、次の push で Cloud Run が自動復帰する事故を
防ぐ。`cloudbuild.yaml` は手動実行時に待機設定を公開設定へ戻せる既存構成のまま残す。

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
既存の Cloud Run 向け CNAME は切替時に事前確認し、Cloudflare が Custom Domain 用 DNS record
へ置き換える。通常の DNS record と Custom Domain record を Terraform から二重管理しない。

`develop-meta/infra` は次の責務を持つ。

- `infra/registry/worksmobile-message-bot.yaml` に Cloudflare account、Worker、Custom Domain、
  deploy token、zone を記録する。
- `provision-cf-api-token --kind=workers-deploy` で `miraius.co.jp` zone に限定した token を
  発行し、1Password へ値を表示せず保存する。
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

### 5.2 切替

1. Worker の既存 deployment と secrets 9 件を再確認する。
2. `main` へ反映し、CI 成功後の Workers deploy を監視する。
3. Custom Domain の certificate と DNS activation を確認する。
4. `https://line-works.api.miraius.co.jp/healthz` が 200 を返すことを確認する。
5. BASIC 認証なしの保護対象 request が 401、正しい認証付き request が期待応答になることを
   確認する。
6. LINE WORKS Callback URL は hostname を変えないため設定値を変更しない。藤井が self channel
   から `/status` を 1 件送信し、Workers での受信、501 への転送、応答 1 件、重複応答なしを
   確認する。
7. GitHub Actions の deploy commit と Workers production version が一致することを確認する。

### 5.3 Cloud Run 待機化

Workers の切替確認後に、別の本番操作ゲートとして次を行う。

1. Cloud Build trigger を無効化する。
2. Cloud Run を `min-instances=0`、`max-instances=1` に更新する。
3. Cloud Run の ingress を内部限定へ変更する。
4. Custom Domain が Workers を向いていることと、Cloud Run の公開 URL が外部から利用できない
   ことを確認する。
5. 切替後 30 分間、Workers logs、Callback、エラー率を監視し、Cloud Run が 0 instance の
   ままかを確認する。

翌日、24 時間分の Workers logs と Cloud Run instance 数を再確認する。これは移行後の
フォローアップであり、深夜切替の完了条件には含めない。

## 6. ロールバック

切替後に重大障害が起きた場合は、次の順で戻す。

1. 単純な Worker regression なら `wrangler rollback <version-id>` で直前 version へ戻す。
2. Workers 基盤・Custom Domain の障害なら Cloud Build を手動実行し、Cloud Run の公開 ingress と
   `min-instances=1` を復帰する。
3. `line-works.api.miraius.co.jp` を Cloud Run の既存 domain mapping 用 CNAME へ戻す。
4. `/healthz`、BASIC 認証、Callback 転送を確認してからロールバック完了とする。

Cloud Run service と Cloud Run domain mapping は今回削除しないため、ロールバック時に新規作成を
必要としない。

## 7. エラー処理と安全策

- CI が失敗した commit はデプロイしない。
- GitHub deploy token は account 全体ではなく対象 account と `miraius.co.jp` zone に限定する。
- token 値、Workers secrets、1Password の値をログや設計書へ出さない。
- DNS 切替前に既存 record の type、content、record ID を読み取り、推測で削除しない。
- Cloud Build trigger 無効化と Cloud Run 待機化は Workers の本番疎通後に実行する。
- callback dedup は isolate 間で共有されないため、移行時点では 501 側 dedup を最終防衛線とする。
- Workers deploy と Cloud Run 復旧操作を同時に行わない。

## 8. 検証

### 静的・自動検証

- `bunx tsc --noEmit`
- `bunx biome check ./src ./tests ./scripts`
- `bun test`
- `bunx wrangler deploy --dry-run`
- `wrangler-config.test.ts` で Worker name、entrypoint、compatibility、Custom Domain を固定する。
- GitHub Actions を actionlint で検査する。
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

- `.github/workflows/deploy-workers.yml` 新設
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
