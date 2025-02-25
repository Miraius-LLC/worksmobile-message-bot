const generateJWT = require('../../../middleware/generateJWT')
const fetchServerAccessToken = require('../../../middleware/serverToken')
const sendImageCarouselMessage = require('../../../services/message/imageCarousel')

const BOT_ID = process.env.BOT_ID

/**
 * @route POST /channels/:channelId/messages/type/image_carousel
 * @description 指定されたトークルームに画像カルーセルメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {Array} columns - 画像カルーセルのオブジェクトリスト (最大10個)。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = channelId => async (req, res) => {
  try {
    const { columns, quickReply } = req.body
    if (!Array.isArray(columns) || columns.length === 0)
      return res.status(400).send("リクエストに必要なパラメータ 'columns' が不足しています。")

    const jwtToken = await generateJWT()
    const serverToken = await fetchServerAccessToken(jwtToken)

    await sendImageCarouselMessage(BOT_ID, serverToken, {
      channelId,
      columns,
      quickReply,
    })

    res.status(200).send()
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`)
  }
}
