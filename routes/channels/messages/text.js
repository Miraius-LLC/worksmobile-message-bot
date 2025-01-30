const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendTextMessage = require("../../../services/message/text");

const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /channels/:channelId/messages/type/text
 * @description 指定されたトークルームにテキストメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {string} text - 送信するテキストメッセージ。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - テキストメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = (channelId) => async (req, res) => {
  try {
    if (!req.body.text)
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'text' が不足しています。");

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    await sendTextMessage(BOT_ID, serverToken, { channelId, ...req.body });

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`);
  }
};
