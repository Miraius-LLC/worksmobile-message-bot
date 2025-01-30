const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendFlexMessage = require("../../../services/message/flex");

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
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = (channelId) => async (req, res) => {
  try {
    const { altText, contents, quickReply } = req.body;
    if (!altText)
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'altText' が不足しています。");
    if (!contents)
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'contents' が不足しています。");

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    await sendFlexMessage(BOT_ID, serverToken, {
      channelId,
      altText,
      contents,
      quickReply,
    });

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`);
  }
};
