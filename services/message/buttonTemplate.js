const sendMessage = require('./send')
const { validateAction, validateStringParam } = require('../../utils/validates')

async function sendButtonTemplateMessage(botId, token, params) {
  const { contentText, actions } = params

  validateStringParam(contentText, 'contentText')

  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("パラメータ 'actions' は必須で、1つ以上のアクションを指定してください。")
  }

  for (const [index, action] of actions.entries()) {
    try {
      validateAction(action, false)
    } catch (error) {
      throw new Error(`アクション ${index + 1} の検証に失敗しました: ${error.message}`)
    }
  }

  await sendMessage(botId, token, params, {
    type: 'button_template',
    contentText,
    actions,
  })
}

module.exports = sendButtonTemplateMessage
