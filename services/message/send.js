const sendAPIMessage = require('../../middleware/sendAPIMessage')
const { validateQuickReply } = require('../../utils/validates')

function buildMessageUrl(botId, { userId, channelId }) {
  if (!(userId || channelId)) {
    throw new Error('送信先が指定されていません (userId または channelId)。')
  }
  const target = userId ? `users/${userId}/messages` : `channels/${channelId}/messages`
  return `https://www.worksapis.com/v1.0/bots/${botId}/${target}`
}

function validateOptionalQuickReply(quickReply) {
  if (!quickReply) return
  if (typeof quickReply !== 'object') {
    throw new Error("パラメータ 'quickReply' はオブジェクト形式で指定してください。")
  }
  try {
    validateQuickReply(quickReply)
  } catch (error) {
    throw new Error(`クイックリプライの検証に失敗しました: ${error.message}`)
  }
}

async function sendMessage(botId, token, params, content) {
  const url = buildMessageUrl(botId, params)
  validateOptionalQuickReply(params.quickReply)
  if (params.quickReply) {
    content.quickReply = params.quickReply
  }
  await sendAPIMessage(token, url, { content })
}

module.exports = sendMessage
