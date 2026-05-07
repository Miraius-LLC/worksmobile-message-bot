const sendMessage = require('./send')
const { validateStringParam } = require('../../utils/validates')

async function sendTextMessage(botId, token, params) {
  validateStringParam(params.text, 'text', 2000)

  await sendMessage(botId, token, params, {
    type: 'text',
    text: params.text,
  })
}

module.exports = sendTextMessage
