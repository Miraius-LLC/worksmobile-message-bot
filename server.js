const express = require("express");
const bodyParser = require("body-parser");
const basicAuth = require("express-basic-auth");

const app = express();
const PORT = process.env.PORT || 8080;

// BASIC 認証
app.use(
  basicAuth({
    users: { [process.env.BASIC_ID]: process.env.BASIC_PASS },
    challenge: true,
    unauthorizedResponse: "Unauthorized",
  })
);

app.use(bodyParser.json());
app.get("/", (req, res) => res.send("Hello World."));

// 動的ルート登録
const messageTypes = [
  "text",
  "sticker",
  "image",
  "file",
  "link",
  "button_template",
  "list_template",
  "carousel",
  "image_carousel",
  "flex",
];

["channels", "users"].forEach((base) => {
  messageTypes.forEach((type) => {
    app.post(`/${base}/:id/messages/type/${type}`, async (req, res, next) => {
      try {
        await require(`./routes/${base}/messages/${type}`)(req.params.id)(
          req,
          res,
          next
        );
      } catch (error) {
        res.status(500).json({ error: `ルート処理エラー: ${error.message}` });
      }
    });
  });
});

// ファイル添付
app.use("/attachments", require("./routes/attachments/upload"));

// 404ハンドリング
app.use((req, res) =>
  res.status(404).json({ error: "Not Found", path: req.originalUrl })
);

app.listen(PORT, () => console.log(`Server running on port ${PORT}...`));
