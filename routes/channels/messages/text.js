const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendTextMessage = require("../../../services/message/text");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /channels/:channelId/messages/type/text
 * @description 指定されたトークルームにテキストメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {string} text - 送信するメッセージ内容（2000文字以内）。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - テキストメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しているか、制約に違反しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:channelId", async (req, res) => {
  try {
    const { text, quickReply } = req.body;
    const { channelId } = req.params;

    // 必須パラメータのチェック
    if (!channelId) {
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'channelId' が不足しています。");
    }

    if (!text) {
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'text' が不足しています。");
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してメッセージを送信
    await sendTextMessage(BOT_ID, serverToken, { channelId, text, quickReply });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
