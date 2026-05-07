const sendMessage = require('./send')
const { validateImageUrl } = require('../../utils/validates')

async function sendImageMessage(botId, token, params) {
  const { previewImageUrl, originalContentUrl, fileId } = params

  if (![previewImageUrl, originalContentUrl, fileId].some(Boolean)) {
    throw new Error(
      "パラメータ 'previewImageUrl'、'originalContentUrl'、'fileId' のいずれかを指定してください。",
    )
  }

  if (previewImageUrl) validateImageUrl(previewImageUrl, 'previewImageUrl')
  if (originalContentUrl) validateImageUrl(originalContentUrl, 'originalContentUrl')

  await sendMessage(botId, token, params, {
    type: 'image',
    ...(previewImageUrl && { previewImageUrl }),
    ...(originalContentUrl && { originalContentUrl }),
    ...(fileId && { fileId }),
  })
}

module.exports = sendImageMessage
