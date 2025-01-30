const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendLinkMessage = require("../../../services/message/link");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /users/:userId/messages/type/link
 * @description 指定されたユーザーにリンクメッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} contentText - 本文のテキスト。必須項目。
 * @param {string} linkText - リンクのテキスト。必須項目。
 * @param {string} link - クリック時の遷移先URL。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:userId", async (req, res) => {
  try {
    const { contentText, linkText, link, quickReply } = req.body;
    const { userId } = req.params;

    if (!userId || !contentText || !linkText || !link) {
      return res
        .status(400)
        .send(
          "必須パラメータ 'userId', 'contentText', 'linkText', 'link' が不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してリンクメッセージを送信
    await sendLinkMessage(BOT_ID, serverToken, {
      userId,
      contentText,
      linkText,
      link,
      quickReply,
    });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
