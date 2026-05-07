const sendMessage = require('./send')
const { validateAction, validateActionObject } = require('../../utils/validates')

async function sendCarouselMessage(botId, token, params) {
  const { imageAspectRatio = 'rectangle', imageSize = 'cover', columns } = params

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("パラメータ 'columns' は必須で、1つ以上の項目を指定してください。")
  }
  if (columns.length > 10) {
    throw new Error('カルーセルのカラム数は最大10個までです。')
  }

  for (const [index, column] of columns.entries()) {
    if (
      !(
        (column.originalContentUrl || column.fileId) &&
        column.text &&
        Array.isArray(column.actions)
      )
    ) {
      throw new Error(
        `カラム ${index + 1} には 'originalContentUrl' または 'fileId', 'text', 'actions' が必要です。`,
      )
    }

    const maxTextLength = column.originalContentUrl || column.title ? 60 : 120
    if (column.text.length > maxTextLength) {
      throw new Error(`カラム ${index + 1} の 'text' は最大 ${maxTextLength} 文字までです。`)
    }

    if (column.defaultAction) {
      try {
        validateActionObject(column.defaultAction, `カラム ${index + 1} の 'defaultAction'`, true)
      } catch (error) {
        throw new Error(`カラム ${index + 1} の 'defaultAction' が無効です: ${error.message}`)
      }
    }

    for (const [actionIndex, action] of column.actions.entries()) {
      try {
        validateAction(action, false)
      } catch (error) {
        throw new Error(
          `カラム ${index + 1} の 'actions' のアクション ${actionIndex + 1} が無効です: ${error.message}`,
        )
      }
    }
  }

  await sendMessage(botId, token, params, {
    type: 'carousel',
    imageAspectRatio,
    imageSize,
    columns,
  })
}

module.exports = sendCarouselMessage
