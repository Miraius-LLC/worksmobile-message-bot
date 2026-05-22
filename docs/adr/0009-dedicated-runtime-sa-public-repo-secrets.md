# 専用 runtime SA + 公開リポ向け secret 運用

Cloud Run の runtime SA は **専用 SA**（`worksmobile-message-bot-sa`）を使い、デフォルトの compute SA は使わない（権限分離）。SA は必要な secret の `secretAccessor` ロールのみを持つ。機密 env（client secret / private key / BASIC 認証 / bot secret 等）は Cloud Run の env に直書きせず **Secret Manager** に置き、`:latest` を参照する設定（`--update-secrets=...`）にして、再 deploy 不要で値だけ差し替えられるようにする。

このリポは **公開**なので、機密度の低い env も含め **値自体を `cloudbuild.yaml` に書かない**。GCP Console の Cloud Build トリガー設定の substitution variable に値を入れ、yaml 側はプレースホルダ参照（`${_...}`）のみにする。

_出典: CLAUDE.md 注意点（Docker / デプロイ）/ README.md デプロイ・Secret のローテーション_
