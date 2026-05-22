# Docker / Cloud Build の制約

イメージは **マルチステージビルド**で、builder（`oven/bun:<ver>-debian`）で `bun install` + `bun run build` し、runtime（`oven/bun:<ver>-slim`）には `build/index.js` だけを COPY する（`node_modules` / `tsconfig.json` / `package.json` は runtime に残さない）。**BuildKit 限定構文は使わない**（Cloud Build 既定の `gcr.io/cloud-builders/docker` が BuildKit 非対応のため `--mount=type=cache` / `--mount=type=secret` は禁止、普通のレイヤキャッシュで代替）。**非 root で起動**（`USER bun`、COPY は `--chown=bun:bun`）。HEALTHCHECK は **curl を入れず `bun -e "fetch(...)"`** で `/healthz` を叩く。build / deploy パイプラインは **`cloudbuild.yaml` が SoT**（trigger に inline build を残さず、SA / secrets / scaling / resources / `--no-use-http2` / labels をすべてここで管理し、手動 `gcloud run services update` での drift を防ぐ）。bun のバージョンは Dockerfile の `FROM` 2 行で固定し `.tool-versions` と一致させる。

_出典: CLAUDE.md 注意点（Docker / デプロイ）/ README.md デプロイ_
