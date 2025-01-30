const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendTextMessage = require("../../../services/message/text");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /users/:userId/messages/type/text
 * @description 指定されたユーザーにテキストメッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} text - 送信するメッセージ内容（2000文字以内）。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - テキストメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しているか、制約に違反しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:userId", async (req, res) => {
  try {
    const { text, quickReply } = req.body;
    const { userId } = req.params;

    // 必須パラメータのチェック
    if (!userId) {
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'userId' が不足しています。");
    }

    if (!text) {
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'text' が不足しています。");
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してメッセージを送信
    await sendTextMessage(BOT_ID, serverToken, { userId, text, quickReply });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
