# ベースイメージ
FROM node:23.7.0-alpine

# 作業ディレクトリの設定
WORKDIR /usr/src/app

# パッケージをコピーしてインストール
COPY package*.json ./
RUN npm ci --only=production && \
  npm cache clean --force

# ソースコードをコピー
COPY . .

# 環境変数設定
ENV NODE_ENV=production \
  PORT=8080

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# ポート設定
EXPOSE 8080

# サーバーの起動コマンド
CMD ["node", "server.js"]
