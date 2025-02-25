const generateJWT = require('../../../middleware/generateJWT')
const fetchServerAccessToken = require('../../../middleware/serverToken')
const sendLinkMessage = require('../../../services/message/link')

const BOT_ID = process.env.BOT_ID

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
 * @returns {400} リクエストエラー - 必須パラメータが不足しています。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
module.exports = userId => async (req, res) => {
  try {
    const { contentText, linkText, link, quickReply } = req.body
    if (!contentText)
      return res.status(400).send("リクエストに必要なパラメータ 'contentText' が不足しています。")
    if (!linkText)
      return res.status(400).send("リクエストに必要なパラメータ 'linkText' が不足しています。")
    if (!link) return res.status(400).send("リクエストに必要なパラメータ 'link' が不足しています。")

    const jwtToken = await generateJWT()
    const serverToken = await fetchServerAccessToken(jwtToken)

    await sendLinkMessage(BOT_ID, serverToken, {
      userId,
      contentText,
      linkText,
      link,
      quickReply,
    })

    res.status(200).send()
  } catch (error) {
    res.status(500).send(`エラーが発生しました: ${error.message}`)
  }
}
