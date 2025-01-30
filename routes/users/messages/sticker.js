const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendStickerMessage = require("../../../services/message/sticker");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /users/:userId/messages/type/sticker
 * @description 指定されたユーザーにスタンプメッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} packageId - スタンプのパッケージID。必須項目。
 * @param {string} stickerId - スタンプID。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - スタンプメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しているか、制約に違反しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:userId", async (req, res) => {
  try {
    const { packageId, stickerId, quickReply } = req.body;
    const { userId } = req.params;

    if (!userId || !packageId || !stickerId) {
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'userId', 'packageId', 'stickerId' が不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してメッセージを送信
    await sendStickerMessage(BOT_ID, serverToken, {
      userId,
      packageId,
      stickerId,
      quickReply,
    });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
