const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendCarouselMessage = require("../../../services/message/carousel");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /users/:userId/messages/type/carousel
 * @description 指定されたユーザーにカルーセルメッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} [imageAspectRatio] - 画像の比率 ("rectangle" または "square")。任意。
 * @param {string} [imageSize] - 画像のサイズ ("cover" または "contain")。任意。
 * @param {Array} columns - カルーセルのカラムオブジェクトリスト (最大10個)。必須項目。
 *
 * @returns {200} 成功 - メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:userId", async (req, res) => {
  try {
    const { imageAspectRatio, imageSize, columns } = req.body;
    const { userId } = req.params;

    if (
      !userId ||
      !columns ||
      !Array.isArray(columns) ||
      columns.length === 0
    ) {
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'userId' または 'columns' が不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してカルーセルメッセージを送信
    await sendCarouselMessage(BOT_ID, serverToken, {
      userId,
      imageAspectRatio,
      imageSize,
      columns,
    });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
