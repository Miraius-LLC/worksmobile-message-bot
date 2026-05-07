const sendMessage = require('./send')
const { validateStringParam } = require('../../utils/validates')

async function sendFlexMessage(botId, token, params) {
  const { altText, contents } = params

  validateStringParam(altText, 'altText', 400)

  if (!contents || typeof contents !== 'object') {
    throw new Error("'contents' は必須で、オブジェクト形式で指定してください。")
  }

  await sendMessage(botId, token, params, {
    type: 'flex',
    altText,
    contents,
  })
}

module.exports = sendFlexMessage
