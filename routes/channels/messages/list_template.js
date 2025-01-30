const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendListTemplateMessage = require("../../../services/message/listTemplate");

const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /channels/:channelId/messages/type/list_template
 * @description 指定されたトークルームにリストテンプレートメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {Object} [coverData] - カバー画像データ。任意。
 * @param {Array} elements - リスト項目の配列。必須項目。
 * @param {Array} [actions] - 全体に関連付けるアクションボタン。任意。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = (channelId) => async (req, res) => {
  try {
    const { coverData, elements, actions, quickReply } = req.body;
    if (!Array.isArray(elements) || elements.length === 0)
      return res
        .status(400)
        .send("リクエストに必要なパラメータ 'elements' が不足しています。");

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    await sendListTemplateMessage(BOT_ID, serverToken, {
      channelId,
      coverData,
      elements,
      actions,
      quickReply,
    });

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`);
  }
};
