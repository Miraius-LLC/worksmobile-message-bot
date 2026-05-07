# =============================================================================
# worksmobile-message-bot - Cloud Run 等向け Docker イメージ
#
# - 2 ステージ (builder + runtime) で最終イメージは bun build 済の単一ファイルだけ
#   - node_modules や tsconfig.json は runtime に残らない
# - BuildKit を要求しない (Cloud Build のデフォルト `gcr.io/cloud-builders/docker`
#   が BuildKit 非対応のため。`--mount=type=cache` 等の BuildKit 限定構文は使わない)
# - 非 root (`bun` user, uid 1000) で起動
# - HEALTHCHECK は curl を入れず Bun の fetch で済ませる
# =============================================================================

# ---------- builder ----------
FROM oven/bun:1.3.13-debian AS builder

WORKDIR /app

# 依存解決 (package.json と bun.lock 不変ならレイヤキャッシュがそのまま使える)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ソース + tsconfig を取り込み build/index.js を出力
COPY src ./src
COPY tsconfig.json ./
RUN bun run build

# ---------- runtime ----------
FROM oven/bun:1.3.13-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ=Asia/Tokyo

WORKDIR /app

# tzdata: ログタイムスタンプを JST に。ca-certificates: LINE WORKS への HTTPS 検証用
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
    && rm -rf /var/lib/apt/lists/*

# bun build がすべてバンドル済みなので node_modules / package.json は不要
COPY --from=builder --chown=bun:bun /app/build ./build

USER bun

EXPOSE 8080

# HEALTHCHECK は Bun の fetch で /health を叩く (curl パッケージは入れない)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "const r=await fetch('http://localhost:'+(process.env.PORT||8080)+'/health');process.exit(r.ok?0:1)" \
        || exit 1

CMD ["bun", "build/index.js"]
