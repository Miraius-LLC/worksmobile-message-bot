const generateJWT = require('../../../middleware/generateJWT')
const fetchServerAccessToken = require('../../../middleware/serverToken')
const sendTextMessage = require('../../../services/message/text')

const BOT_ID = process.env.BOT_ID

/**
 * @route POST /users/:userId/messages/type/text
 * @description 指定されたユーザーにテキストメッセージを送信します。
 *
 * @param {string} userId - メッセージを送信する対象のユーザーID（URLパスパラメータ）。
 * @param {string} text - 送信するメッセージ内容（2000文字以内）。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - テキストメッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = userId => async (req, res) => {
  try {
    const { text, quickReply } = req.body
    if (!text) return res.status(400).send("リクエストに必要なパラメータ 'text' が不足しています。")

    const jwtToken = await generateJWT()
    const serverToken = await fetchServerAccessToken(jwtToken)

    await sendTextMessage(BOT_ID, serverToken, { userId, text, quickReply })

    res.status(200).send()
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`)
  }
}
