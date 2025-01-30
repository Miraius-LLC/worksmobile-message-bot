const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendButtonTemplateMessage = require("../../../services/message/buttonTemplate");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /users/:userId/messages/type/button_template
 * @description 指定されたユーザーにボタンテンプレートメッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} contentText - ボタンテンプレートに表示されるテキスト。必須項目。
 * @param {Array} actions - アクションオブジェクトのリスト。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:userId", async (req, res) => {
  try {
    const { contentText, actions, quickReply } = req.body;
    const { userId } = req.params;

    if (
      !userId ||
      !contentText ||
      !actions ||
      !Array.isArray(actions) ||
      actions.length === 0
    ) {
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'userId', 'contentText', または 'actions' が不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してボタンテンプレートメッセージを送信
    await sendButtonTemplateMessage(BOT_ID, serverToken, {
      userId,
      contentText,
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
