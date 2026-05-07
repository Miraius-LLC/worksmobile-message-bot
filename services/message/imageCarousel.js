const sendMessage = require('./send')
const { validateAction, validateImageUrl } = require('../../utils/validates')

async function sendImageCarouselMessage(botId, token, params) {
  const { columns } = params

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("パラメータ 'columns' は必須で、1つ以上の項目を指定してください。")
  }
  if (columns.length > 10) {
    throw new Error("パラメータ 'columns' の配列長は最大10個までです。")
  }

  for (const [index, column] of columns.entries()) {
    if (!(column.originalContentUrl || column.fileId)) {
      throw new Error(
        `カラム ${index + 1} には 'originalContentUrl' または 'fileId' のいずれかが必要です。`,
      )
    }
    if (column.originalContentUrl) {
      validateImageUrl(column.originalContentUrl, `columns[${index}].originalContentUrl`)
    }
    if (column.action) {
      try {
        validateAction(column.action, false)
      } catch (error) {
        throw new Error(`カラム ${index + 1} のアクションが無効です: ${error.message}`)
      }
    }
  }

  await sendMessage(botId, token, params, {
    type: 'image_carousel',
    columns,
  })
}

module.exports = sendImageCarouselMessage
