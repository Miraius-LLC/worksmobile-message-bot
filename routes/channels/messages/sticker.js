const generateJWT = require('../../../middleware/generateJWT')
const fetchServerAccessToken = require('../../../middleware/serverToken')
const sendStickerMessage = require('../../../services/message/sticker')

const BOT_ID = process.env.BOT_ID

/**
 * @route POST /channels/:channelId/messages/type/sticker
 * @description 指定されたトークルームにスタンプメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {string} packageId - スタンプのパッケージID。必須項目。
 * @param {string} stickerId - スタンプID。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - スタンプメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = channelId => async (req, res) => {
  try {
    const { packageId, stickerId, quickReply } = req.body
    if (!packageId)
      return res.status(400).send("リクエストに必要なパラメータ 'packageId' が不足しています。")
    if (!stickerId)
      return res.status(400).send("リクエストに必要なパラメータ 'stickerId' が不足しています。")

    const jwtToken = await generateJWT()
    const serverToken = await fetchServerAccessToken(jwtToken)

    await sendStickerMessage(BOT_ID, serverToken, {
      channelId,
      packageId,
      stickerId,
      quickReply,
    })

    res.status(200).send()
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`)
  }
}
