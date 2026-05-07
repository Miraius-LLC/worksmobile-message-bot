const sendMessage = require('./send')
const { validateStringParam } = require('../../utils/validates')

async function sendStickerMessage(botId, token, params) {
  validateStringParam(params.packageId, 'packageId')
  validateStringParam(params.stickerId, 'stickerId')

  await sendMessage(botId, token, params, {
    type: 'sticker',
    packageId: params.packageId,
    stickerId: params.stickerId,
  })
}

module.exports = sendStickerMessage
