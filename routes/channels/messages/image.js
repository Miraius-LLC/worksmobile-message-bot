const generateJWT = require('../../../middleware/generateJWT')
const fetchServerAccessToken = require('../../../middleware/serverToken')
const sendImageMessage = require('../../../services/message/image')

const BOT_ID = process.env.BOT_ID

/**
 * @route POST /channels/:channelId/messages/type/image
 * @description 指定されたトークルームに画像メッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {string} [previewImageUrl] - プレビュー画像のURL (PNG形式、HTTPSのみ)。最大1,000文字。
 * @param {string} [originalContentUrl] - 元画像のURL (PNG形式、HTTPSのみ)。最大1,000文字。
 * @param {string} [fileId] - アップロードされた画像のファイルID。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - 画像メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = channelId => async (req, res) => {
  try {
    const { previewImageUrl, originalContentUrl, fileId, quickReply } = req.body
    if (!previewImageUrl && !originalContentUrl && !fileId)
      return res
        .status(400)
        .send(
          "リクエストに必要なパラメータ 'previewImageUrl'、'originalContentUrl'、または 'fileId' のいずれかが不足しています。",
        )

    const jwtToken = await generateJWT()
    const serverToken = await fetchServerAccessToken(jwtToken)

    await sendImageMessage(BOT_ID, serverToken, {
      channelId,
      previewImageUrl,
      originalContentUrl,
      fileId,
      quickReply,
    })

    res.status(200).send()
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`)
  }
}
