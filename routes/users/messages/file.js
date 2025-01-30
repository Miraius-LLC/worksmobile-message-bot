const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendFileMessage = require("../../../services/message/file");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /users/:userId/messages/type/file
 * @description 指定されたユーザーにファイルメッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} [originalContentUrl] - ファイルのURL (HTTPSのみ)。最大1,000文字。`fileId`といずれか一方が必須。
 * @param {string} [fileId] - アップロードされたファイルのID。`originalContentUrl`といずれか一方が必須。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - ファイルメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:userId", async (req, res) => {
  try {
    const { originalContentUrl, fileId, quickReply } = req.body;
    const { userId } = req.params;

    if (!userId || (!originalContentUrl && !fileId)) {
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'userId' と 'originalContentUrl' または 'fileId' のいずれかが不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用してファイルメッセージを送信
    await sendFileMessage(BOT_ID, serverToken, {
      userId,
      originalContentUrl,
      fileId,
      quickReply,
    });

    res.sendStatus(200); // 成功時のレスポンス
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    res.status(500).send(error.message); // 詳細なエラーメッセージをレスポンスに含める
  }
});

module.exports = router;
