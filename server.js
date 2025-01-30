const express = require("express");
const bodyParser = require("body-parser");
const basicAuth = require("express-basic-auth");

// ルート情報をインポート
const routesConfig = require("./config/routesConfig");

const app = express();
const PORT = process.env.PORT || 8080;

// BASIC 認証設定
app.use(
  basicAuth({
    users: { [process.env.BASIC_ID]: process.env.BASIC_PASS },
    challenge: true,
    unauthorizedResponse: "Unauthorized",
  })
);

// JSON ボディパーサーミドルウェア
app.use(bodyParser.json());

// 動作確認用ルート
app.get("/", (req, res) => res.send("Hello World."));

// 各ルートを動的に設定
routesConfig.forEach(({ path, module }) => {
  // console.log(`Registering route: /${path} -> ${module}`);
  app.use(`/${path}`, require(module));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}...`);
});
