const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendListTemplateMessage = require("../../../services/message/listTemplate");

const router = express.Router();
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
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:channelId", async (req, res) => {
  try {
    const { coverData, elements, actions, quickReply } = req.body;
    const { channelId } = req.params;

    if (
      !channelId ||
      !elements ||
      !Array.isArray(elements) ||
      elements.length === 0
    ) {
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'channelId' または 'elements' が不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してメッセージを送信
    await sendListTemplateMessage(BOT_ID, serverToken, {
      channelId,
      coverData,
      elements,
      actions,
      quickReply,
    });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
