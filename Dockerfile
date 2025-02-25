# ベースイメージ
FROM node:23

# 作業ディレクトリの設定
WORKDIR /usr/src/app

# パッケージをコピーしてインストール
COPY package*.json ./
RUN npm install

# ソースコードをコピー
COPY . .

# 環境変数設定
ENV PORT 8080

# ポート設定
EXPOSE 8080

# サーバーの起動コマンド
CMD ["npm", "start"]
