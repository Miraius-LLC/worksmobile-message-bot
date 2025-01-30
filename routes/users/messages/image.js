const express = require("express");
const generateJWT = require("../../../middleware/generateJWT");
const fetchServerAccessToken = require("../../../middleware/serverToken");
const sendImageMessage = require("../../../services/message/image");

const router = express.Router();
const BOT_ID = process.env.BOT_ID;

/**
 * @route POST /users/:userId/messages/type/image
 * @description 指定されたユーザーに画像メッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} [previewImageUrl] - プレビュー画像のURL (PNG形式、HTTPSのみ)。最大1,000文字。
 * @param {string} [originalContentUrl] - 元画像のURL (PNG形式、HTTPSのみ)。最大1,000文字。
 * @param {string} [fileId] - アップロードされた画像のファイルID。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - 画像メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/:userId", async (req, res) => {
  try {
    const { previewImageUrl, originalContentUrl, fileId, quickReply } =
      req.body;
    const { userId } = req.params;

    if (!userId || (!previewImageUrl && !originalContentUrl && !fileId)) {
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'userId' と 'previewImageUrl'、'originalContentUrl'、'fileId' のいずれかが不足しています。"
        );
    }

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // サービス層の共通ロジックを使用して画像メッセージを送信
    await sendImageMessage(BOT_ID, serverToken, {
      userId,
      previewImageUrl,
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
