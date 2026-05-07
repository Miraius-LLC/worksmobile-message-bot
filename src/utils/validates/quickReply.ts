import { validateAction } from './action'
import { validateStringParam } from './stringParam'

export function validateQuickReply(quickReply: unknown): void {
  if (!quickReply || typeof quickReply !== 'object') {
    throw new Error('クイックリプライはオブジェクトである必要があります。')
  }

  const obj = quickReply as { items?: unknown }
  if (!Array.isArray(obj.items) || obj.items.length === 0) {
    throw new Error("クイックリプライには 'items' 配列が必要で、少なくとも1つの項目が必要です。")
  }

  for (const [index, item] of obj.items.entries()) {
    if (!item || typeof item !== 'object') {
      throw new Error(`クイックリプライ項目 ${index + 1} はオブジェクトである必要があります。`)
    }
    const itemObj = item as { action?: unknown; imageUrl?: unknown }
    if (!itemObj.action) {
      throw new Error(`クイックリプライ項目 ${index + 1} には 'action' が必要です。`)
    }

    if (itemObj.imageUrl !== undefined) {
      validateStringParam(itemObj.imageUrl, `quickReply.items[${index}].imageUrl`, 1000)
      if (!/^https:\/\//.test(itemObj.imageUrl)) {
        throw new Error(
          `クイックリプライ項目 ${index + 1} の 'imageUrl' は HTTPS の URL を指定してください。`,
        )
      }
    }

    try {
      validateAction(itemObj.action, false)
    } catch (error) {
      throw new Error(
        `クイックリプライ項目 ${index + 1} のアクションが無効です: ${(error as Error).message}`,
      )
    }
  }
}
