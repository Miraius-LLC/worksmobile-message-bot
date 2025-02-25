const generateJWT = require('../../../middleware/generateJWT')
const fetchServerAccessToken = require('../../../middleware/serverToken')
const sendButtonTemplateMessage = require('../../../services/message/buttonTemplate')

const BOT_ID = process.env.BOT_ID

/**
 * @route POST /channels/:channelId/messages/type/button_template
 * @description 指定されたトークルームにボタンテンプレートメッセージを送信します。
 *
 * @param {string} channelId - メッセージを送信する対象のトークルームID（URLパスパラメータ）。
 * @param {string} contentText - ボタンテンプレートに表示されるテキスト。必須項目。
 * @param {Array} actions - アクションオブジェクトのリスト。必須項目。
 * @param {Object} [quickReply] - クイックリプライオブジェクト（任意）。
 *
 * @returns {200} 成功 - メッセージが正常に送信されました。
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = channelId => async (req, res) => {
  try {
    const { contentText, actions, quickReply } = req.body
    if (!contentText)
      return res.status(400).send("リクエストに必要なパラメータ 'contentText' が不足しています。")
    if (!Array.isArray(actions) || actions.length === 0)
      return res.status(400).send("リクエストに必要なパラメータ 'actions' が不足しています。")

    const jwtToken = await generateJWT()
    const serverToken = await fetchServerAccessToken(jwtToken)

    await sendButtonTemplateMessage(BOT_ID, serverToken, {
      channelId,
      contentText,
      actions,
      quickReply,
    })

    res.status(200).send()
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`)
  }
}
