# syntax=docker/dockerfile:1.7
# =============================================================================
# worksmobile-message-bot - Cloud Run 等向け Docker イメージ (Bun ベース)
# =============================================================================

FROM oven/bun:1.3.13-debian AS base

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=8080 \
    TZ=Asia/Tokyo

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
    && rm -rf /var/lib/apt/lists/*

# ---- 依存インストール ----
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ---- アプリコード ----
COPY src ./src
COPY tsconfig.json ./

# bun build で 1 ファイルに圧縮 (build/ は git 管理外)
RUN bun run build

EXPOSE 8080

# HEALTHCHECK は curl の代わりに Bun の fetch を使う
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "const r=await fetch('http://localhost:'+(process.env.PORT||8080)+'/health');process.exit(r.ok?0:1)" \
        || exit 1

CMD ["bun", "run", "start"]
