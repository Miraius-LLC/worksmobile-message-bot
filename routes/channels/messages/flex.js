const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendFlexMessage = require("../../../services/message/flex");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /channels/:channelId/messages/type/flex
 * @description 指定されたトークルームにフレックスメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {string} altText - トークルームリストとプッシュ通知で表示される代替テキスト。最大400文字。必須項目。
 * @param {Object} contents - Flexible Template コンテナ。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - フレックスメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:channelId", async (req, res) => {
  try {
    const { altText, contents, quickReply } = req.body;
    const { channelId } = req.params;

    if (!channelId || !altText || !contents) {
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'channelId', 'altText', 'contents' が不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してフレックスメッセージを送信
    await sendFlexMessage(BOT_ID, serverToken, {
      channelId,
      altText,
      contents,
      quickReply,
    });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
