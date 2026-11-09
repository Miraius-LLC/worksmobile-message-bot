# Cloud Run へのデプロイ

Cloud Runでは、DockerイメージをCloud Buildでビルドし、Secret Managerの値をマウントして
デプロイする。`.config/cloudbuild.yaml` にruntime SA / scaling / resources / ingressなどを明示し、
Cloud Runへ単独でデプロイできる構成を維持している。

`.config/cloudbuild.yaml` には **runtime SA / Secret Manager マウント / scaling / resources / ingress** 等を全て明示してあり、Cloud Run の構成 drift を防止します。

### 再開前の準備

2026-10-03の対象GCP projectのGET照会では、Cloud Run serviceと専用runtime SA
`worksmobile-message-bot-sa`、Secret Manager secret、Cloud Build trigger、Artifact Registry
repositoryはいずれも存在しなかった。全location照会には到達不能な5 locationが含まれたが、
運用担当者がCloud Runの廃止を確認済み。これは当日の確認記録であり、再開時には対象project・regionの
現在値を再確認する（当時のインフラ台帳に記録）。

再開時は次を準備してから、下の初回設定へ進む。

- **runtime service account**: 専用SAを作成し、利用するsecretごとにSecret Accessorを付与する。
- **Secret Manager**: LINE WORKS / BASIC認証のsecretを登録する。Access保護されたupstreamへ転送する場合は、[Access service tokenの設定](#cloud-run再開時のcloudflare-access-service-token)も行う。
- **Artifact Registryとbuild権限**: `.config/cloudbuild.yaml` の `_AR_HOSTNAME` / `_AR_REPOSITORY` に対応するDocker repositoryを用意する。Cloud Build実行SAにimage push・Cloud Run deploy・runtime SAを使用する権限を設定する。
- **Cloud Run serviceの初回作成**: 現行pipelineのdeploy stepは `gcloud run services update` なので、存在しないserviceは作成できない。再開時に `.config/cloudbuild.yaml` の構成を基に初回作成用の `gcloud run deploy` を用意し、runtime SA・env・secret・HTTP/1.1・公開IAMを揃える。その後はpipelineで更新する。
- **Cloud Build trigger**: GitHub接続・対象branch・`.config/cloudbuild.yaml`・substitution variables・実行SAを設定する。triggerを使わない場合は、下のmanual build手順を使う。
- **最初のbuildのpath確認**: 再開時の最初のbuildで、`.config/Dockerfile`を`-f`で指定し、contextがrepo rootのままであること、`COPY`がrootの`package.json`・`bun.lock`・`src`・`tsconfig.json`を読めることを確認する。この機ではDocker buildを実機検証していない。

### 初回設定

```sh
# 1. 専用 runtime SA を作成
gcloud iam service-accounts create worksmobile-message-bot-sa \
  --display-name="worksmobile-message-bot runtime"

# 2. 機密 env を Secret Manager に投入
echo -n "$CLIENT_SECRET_VALUE" | gcloud secrets create lineworks-client-secret --data-file=-
echo -n "$PRIVATE_KEY_VALUE_BASE64" | gcloud secrets create lineworks-private-key --data-file=-
echo -n "$BASIC_AUTH_USERNAME" | gcloud secrets create lineworks-basic-id --data-file=-
echo -n "$BASIC_AUTH_PASSWORD" | gcloud secrets create lineworks-basic-pass --data-file=-
echo -n "$BOT_SECRET_VALUE" | gcloud secrets create lineworks-bot-secret --data-file=-

# 3. SA に accessor 権限を付与 (per-secret)
for s in lineworks-client-secret lineworks-private-key lineworks-basic-id lineworks-basic-pass lineworks-bot-secret; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:worksmobile-message-bot-sa@<PROJECT_ID>.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done

# 4. 機密度の低い env は Cloud Build の substitution variable として渡す
#    (公開リポに値を残さないため。triggerなら設定画面、manual buildなら
#    gcloud builds submitの--substitutionsを使用する)
#      _SERVICE_ACCOUNT      = Cloud Run runtime service account
#      _CLIENT_ID            = LINE WORKS の client ID
#      _SERVICE_ACCOUNT_LW   = LINE WORKS の service account (例: lrpkq.serviceaccount@xxx)
#      _BOT_ID               = LINE WORKS の bot ID
#      _FORWARD_CALLBACK_URL = callbackの転送先URL（任意）
#      _OAUTH_SCOPE          = OAuth認可スコープ (任意, 省略時 bot)

# 5. Cloud Build trigger を作成する場合は .config/cloudbuild.yaml を指定し、
#    main などデプロイ対象の branch と substitution variables を設定する。

# 6. triggerを使わないmanual buildでは、Gitの実値と必須substitutionを明示する
(
  set -euo pipefail
  if ! git diff --quiet || ! git diff --cached --quiet || \
    [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo "ERROR: manual buildはclean working treeから実行してください" >&2
    exit 1
  fi
  REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
  COMMIT_SHA="$(git rev-parse HEAD)"
  SHORT_SHA="$(git rev-parse --short=7 HEAD)"
  gcloud builds submit . --config=.config/cloudbuild.yaml --ignore-file=.config/gcloudignore \
    --substitutions="REPO_NAME=${REPO_NAME},COMMIT_SHA=${COMMIT_SHA},SHORT_SHA=${SHORT_SHA},_SERVICE_ACCOUNT=${CLOUD_RUN_RUNTIME_SA},_CLIENT_ID=${CLIENT_ID},_SERVICE_ACCOUNT_LW=${SERVICE_ACCOUNT},_BOT_ID=${BOT_ID},_FORWARD_CALLBACK_URL=${FORWARD_CALLBACK_URL:-},_OAUTH_SCOPE=${OAUTH_SCOPE:-}"
)
```

`_SERVICE_ACCOUNT` / `_CLIENT_ID` / `_SERVICE_ACCOUNT_LW` / `_BOT_ID`はsecretではないが、
manual buildではprocess argvとCloud Build metadataから、その環境の権限者に見える。secret値は
`--substitutions`へ渡さず、Secret Manager参照を使う。

### Cloud Run再開時のCloudflare Access service token

`FORWARD_CALLBACK_URL` の転送先がCloudflare Accessで保護されている場合だけ設定する。
現行 `.config/cloudbuild.yaml` は `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` をマウントしないため、
**secretを登録するだけでは転送に使われない**。再開時に次を行い、deploy構成へ反映する。

1. 転送先のAccess applicationでservice tokenを発行し、そのtokenを許可するService Auth policyを設定する。既存tokenを使う場合は対象applicationの許可と有効期限を確認する。
2. Client IDとClient Secretを、それぞれSecret Managerへ登録する。以下の変数は取得済みの値を表し、値を文書・substitution・通常envへ書かない。

   ```sh
   printf '%s' "$CF_ACCESS_CLIENT_ID_VALUE" | gcloud secrets create lineworks-cf-access-client-id --data-file=-
   printf '%s' "$CF_ACCESS_CLIENT_SECRET_VALUE" | gcloud secrets create lineworks-cf-access-client-secret --data-file=-
   for s in lineworks-cf-access-client-id lineworks-cf-access-client-secret; do
     gcloud secrets add-iam-policy-binding "$s" \
       --member="serviceAccount:worksmobile-message-bot-sa@<PROJECT_ID>.iam.gserviceaccount.com" \
       --role=roles/secretmanager.secretAccessor
   done
   ```

3. 再開時に `.config/cloudbuild.yaml` のdeploy stepの既存 `--update-secrets` に、次の2 mappingを追加する。初回service作成にも同じmappingを渡す。手動updateだけで済ませず、pipeline側の構成を正本にする。

   ```text
   CF_ACCESS_CLIENT_ID=lineworks-cf-access-client-id:latest
   CF_ACCESS_CLIENT_SECRET=lineworks-cf-access-client-secret:latest
   ```

4. `_FORWARD_CALLBACK_URL` に対象upstream URLを設定し、deploy後に署名付きcallbackがupstreamまで到達することを確認する。両変数の片方だけでは起動時validationに失敗する。転送先の401 / 403はcallbackの500応答になるため、tokenの許可・失効も確認する。

### Docker イメージの実装上の注意

構造的な決定は [ADR-0008](../adr/0008-docker-cloud-build-constraints.md) (マルチステージ / BuildKit 不可 / 非 root / curl レス healthcheck / .config/cloudbuild.yaml が SoT)、SA / secret 運用は [ADR-0009](../adr/0009-dedicated-runtime-sa-public-repo-secrets.md)。

- runtime ベースは `oven/bun:<ver>-slim` (debian-slim)、builder は `oven/bun:<ver>-debian` (フル) を使い分ける
- CMD は `["bun", "build/index.js"]` で直接バンドルを起動する (`bun run start` → package.json 参照を避ける)
- `.env` は `.dockerignore` で build context から除外済み。Cloud Run へは `--set-env-vars` / `--set-secrets` で注入する
- 機密度の低い env も substitution variable 経由で渡し、yaml には値を残さない

### Cloud Run Secret Manager のローテーション

Cloud Run は `:latest` を参照しているので、**再デプロイ無し**で値だけ更新可能:
```sh
echo -n "$NEW_VALUE" | gcloud secrets versions add lineworks-client-secret --data-file=-
# Cloud Run は次の cold start で新しい version を読む。即時反映したい場合は revision update
```

### HTTP プロトコル

公開側の HTTP/2 は Cloud Run フロントエンドが終端し、コンテナへは HTTP/1.1 で渡す構成です (`.config/cloudbuild.yaml` の `--no-use-http2`)。クライアントから見ると HTTP/2 で接続できます。

### Artifact Registry のクリーンアップ

Artifact Registryでは、用途に合わせてcleanup policyを設定してください。例えば:
- タグ無しイメージは 7 日後に自動削除
- タグ付きイメージは最新 10 件を保持
