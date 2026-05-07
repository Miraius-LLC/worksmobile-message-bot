const sendMessage = require('./send')
const { validateStringParam, validateUrl } = require('../../utils/validates')

async function sendLinkMessage(botId, token, params) {
  const { contentText, linkText, link } = params

  validateStringParam(contentText, 'contentText', 1000)
  validateStringParam(linkText, 'linkText', 1000)
  validateUrl(link, 'link', 1000)

  await sendMessage(botId, token, params, {
    type: 'link',
    contentText,
    linkText,
    link,
  })
}

module.exports = sendLinkMessage
