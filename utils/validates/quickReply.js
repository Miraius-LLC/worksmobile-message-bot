const { validateAction } = require('./action')
const validateStringParam = require('./stringParam')

function validateQuickReply(quickReply) {
  if (!quickReply || typeof quickReply !== 'object') {
    throw new Error('クイックリプライはオブジェクトである必要があります。')
  }

  if (!Array.isArray(quickReply.items) || quickReply.items.length === 0) {
    throw new Error("クイックリプライには 'items' 配列が必要で、少なくとも1つの項目が必要です。")
  }

  for (const [index, item] of quickReply.items.entries()) {
    if (!item.action) {
      throw new Error(`クイックリプライ項目 ${index + 1} には 'action' が必要です。`)
    }

    if (item.imageUrl) {
      validateStringParam(item.imageUrl, `quickReply.items[${index}].imageUrl`, 1000)
      if (!/^https:\/\//.test(item.imageUrl)) {
        throw new Error(
          `クイックリプライ項目 ${index + 1} の 'imageUrl' は HTTPS の URL を指定してください。`,
        )
      }
    }

    try {
      validateAction(item.action, false)
    } catch (error) {
      throw new Error(`クイックリプライ項目 ${index + 1} のアクションが無効です: ${error.message}`)
    }
  }
}

module.exports = validateQuickReply
