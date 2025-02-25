const generateJWT = require('../../../middleware/generateJWT')
const fetchServerAccessToken = require('../../../middleware/serverToken')
const sendCarouselMessage = require('../../../services/message/carousel')

const BOT_ID = process.env.BOT_ID

/**
 * @route POST /channels/:channelId/messages/type/carousel
 * @description 指定されたトークルームにカルーセルメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {string} [imageAspectRatio] - 画像の比率 ("rectangle" または "square")。任意。
 * @param {string} [imageSize] - 画像のサイズ ("cover" または "contain")。任意。
 * @param {Array} columns - カルーセルのカラムオブジェクトリスト (最大10個)。必須項目。
 *
 * @returns {200} 成功 - メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = channelId => async (req, res) => {
  try {
    const { imageAspectRatio, imageSize, columns } = req.body
    if (!Array.isArray(columns) || columns.length === 0)
      return res.status(400).send("リクエストに必要なパラメータ 'columns' が不足しています。")

    const jwtToken = await generateJWT()
    const serverToken = await fetchServerAccessToken(jwtToken)

    await sendCarouselMessage(BOT_ID, serverToken, {
      channelId,
      imageAspectRatio,
      imageSize,
      columns,
    })

    res.status(200).send()
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`)
  }
}
